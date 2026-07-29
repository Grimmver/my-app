import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const SHARED_PASSWORD = "123"; // Ваш пароль для входа

// Подключение к облачной базе Turso
// Если запуск на локальном компьютере и ключей нет, создастся файл local.db
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

// Инициализация таблиц базы данных
(async () => {
  try {
    // 1. Таблица категорий
    await db.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT,
        color TEXT
      );
    `);
    
    // 2. Таблица товаров
    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        internalCode TEXT,
        govCode TEXT,
        quantity INTEGER,
        price REAL,
        cost REAL,
        categoryId TEXT
      );
    `);
    
    // 3. Безопасное добавление колонок для аналитики продаж (если их еще нет)
    try {
      await db.execute('ALTER TABLE products ADD COLUMN sold_quantity INTEGER DEFAULT 0');
    } catch (e) { /* Игнорируем ошибку, если колонка уже существует */ }

    try {
      await db.execute('ALTER TABLE products ADD COLUMN realized_profit REAL DEFAULT 0');
    } catch (e) { /* Игнорируем ошибку, если колонка уже существует */ }
    
    // 4. Таблица истории
    await db.execute(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        product_name TEXT,
        field TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("Успешно подключено к базе данных Turso");
  } catch (err) {
    console.error("Ошибка инициализации базы данных Turso:", err);
  }
})();

// Middleware: Проверка пароля
const authenticate = (req, res, next) => {
  const password = req.headers['authorization'];
  if (password === SHARED_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Неверный пароль доступа' });
  }
};

// API: Авторизация
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === SHARED_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Неверный пароль' });
  }
});

// API: Получение всех данных (товары и категории)
app.get('/api/data', authenticate, async (req, res) => {
  try {
    const productsResult = await db.execute('SELECT * FROM products');
    const categoriesResult = await db.execute('SELECT * FROM categories');
    res.json({ 
      products: productsResult.rows, 
      categories: categoriesResult.rows 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Получение истории (последние 50 записей)
app.get('/api/history', authenticate, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT * FROM history 
      ORDER BY id DESC 
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Экспорт истории (всей или с лимитом)
app.get('/api/history/export', authenticate, async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  
  let sql = `SELECT * FROM history ORDER BY id DESC`;
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  try {
    const result = await db.execute(sql);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Добавление одного товара
app.post('/api/products', authenticate, async (req, res) => {
  const p = req.body;
  try {
    await db.execute({
      sql: `INSERT INTO products (id, name, internalCode, govCode, quantity, price, cost, categoryId) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [p.id, p.name, p.internalCode, p.govCode, p.quantity, p.price, p.cost, p.categoryId]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Быстрое редактирование поля товара (Инвентаризация)
app.put('/api/products/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body;
  
  const allowedFields = ['name', 'quantity', 'price', 'cost', 'categoryId', 'internalCode', 'govCode'];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ error: 'Недопустимое поле' });
  }

  try {
    const oldData = await db.execute({
      sql: `SELECT * FROM products WHERE id = ?`,
      args: [id]
    });

    if (oldData.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const oldProduct = oldData.rows[0];
    const oldValue = oldProduct[field];
    const productName = oldProduct.name;

    await db.execute({
      sql: `UPDATE products SET ${field} = ? WHERE id = ?`,
      args: [value, id]
    });

    if (String(oldValue) !== String(value)) {
      await db.execute({
        sql: `INSERT INTO history (product_id, product_name, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)`,
        args: [id, productName, field, String(oldValue), String(value)]
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Продажа товара (вычитает остаток, фиксирует прибыль и количество продаж)
app.post('/api/products/:id/sell', authenticate, async (req, res) => {
  const { id } = req.params;
  const { quantityToSell } = req.body;

  try {
    const data = await db.execute({ sql: `SELECT * FROM products WHERE id = ?`, args: [id] });
    const p = data.rows[0];
    
    if (!p) return res.status(404).json({ error: 'Товар не найден' });
    
    const currentQty = p.quantity || 0;
    const price = p.price || 0;
    const cost = p.cost || 0;
    const currentSold = p.sold_quantity || 0;
    const currentProfit = p.realized_profit || 0;

    const newQty = currentQty - quantityToSell;
    const newSold = currentSold + quantityToSell;
    
    const profitFromThisSale = quantityToSell * (price - cost);
    const newTotalProfit = currentProfit + profitFromThisSale;

    await db.execute({
      sql: `UPDATE products SET quantity = ?, sold_quantity = ?, realized_profit = ? WHERE id = ?`,
      args: [newQty, newSold, newTotalProfit, id]
    });

    await db.execute({
      sql: `INSERT INTO history (product_id, product_name, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)`,
      args: [id, p.name, 'Продажа', `Остаток: ${currentQty}`, `Продано: ${quantityToSell} шт. (Остаток: ${newQty})`]
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Удаление товара
app.delete('/api/products/:id', authenticate, async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Массовое добавление/обновление товаров из Excel (Batch Import)
app.post('/api/products/batch', authenticate, async (req, res) => {
  const products = req.body;
  
  if (!Array.isArray(products)) return res.status(400).json({ error: 'Ожидается массив' });

  try {
    const statements = [];

    for (const p of products) {
      let existing = null;
      
      const resGov = await db.execute({ sql: "SELECT * FROM products WHERE govCode = ?", args: [p.govCode] });
      if (resGov.rows.length > 0) existing = resGov.rows[0];
      
      if (!existing) {
        const resName = await db.execute({ sql: "SELECT * FROM products WHERE name = ?", args: [p.name] });
        if (resName.rows.length > 0) existing = resName.rows[0];
      }
      
      if (!existing && p.internalCode) {
        const resInt = await db.execute({ sql: "SELECT * FROM products WHERE internalCode = ?", args: [p.internalCode] });
        if (resInt.rows.length > 0) existing = resInt.rows[0];
      }

      if (existing) {
        statements.push({
          sql: `UPDATE products SET quantity = ?, price = ?, cost = ?, categoryId = ? WHERE id = ?`,
          args: [p.quantity, p.price, p.cost, p.categoryId, existing.id]
        });
      } else {
        statements.push({
          sql: `INSERT INTO products (id, name, internalCode, govCode, quantity, price, cost, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: ['prod-' + Math.random().toString(36).substr(2, 9), p.name, p.internalCode, p.govCode, p.quantity, p.price, p.cost, p.categoryId]
        });
      }
    }

    await db.batch(statements);
    res.json({ success: true, count: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Создание категории
app.post('/api/categories', authenticate, async (req, res) => {
  const { id, name, color } = req.body;
  try {
    await db.execute({
      sql: `INSERT INTO categories (id, name, color) VALUES (?, ?, ?)`,
      args: [id, name, color]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Удаление категории
app.delete('/api/categories/:id', authenticate, async (req, res) => {
  try {
    await db.batch([
      { sql: 'DELETE FROM categories WHERE id = ?', args: [req.params.id] },
      { sql: 'UPDATE products SET categoryId = "" WHERE categoryId = ?', args: [req.params.id] }
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Редактирование товара (название, штрих-код, цена)
app.put('/products/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, govCode, price } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Название товара не может быть пустым' });
  }

  try {
    const result = await pool.query(
      `UPDATE products 
       SET name = $1, gov_code = $2, price = $3 
       WHERE id = $4 
       RETURNING *`,
      [name.trim(), govCode ? govCode.trim() : null, parseFloat(price) || 0, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка при обновлении товара:', err);
    res.status(500).json({ error: 'Ошибка сервера при обновлении товара' });
  }
});
// Раздача интерфейса React
app.use(express.static(path.join(__dirname, 'dist')));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер работает на порту ${PORT}`));