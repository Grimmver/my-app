import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client'; // Новый клиент для работы с облаком Turso
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const SHARED_PASSWORD = "123"; // Ваш пароль для входа

// Подключение к облачной базе Turso
// Если запуск на компьютере и ключей нет в системе, создастся локальный файл local.db
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

// Инициализация таблиц в облаке
(async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT,
        color TEXT
      );
    `);
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
    console.log("Успешно подключено к облачной базе данных Turso");
  } catch (err) {
    console.error("Ошибка инициализации базы данных Turso:", err);
  }
})();

// Проверка пароля
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

// API: Получение всех данных
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
// Экспорт истории (всей или с лимитом)
app.get('/api/history/export', authenticate, async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  
  // Достаем записи от самых новых к старым
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

// API: Добавление товара
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

// API: Быстрое редактирование товара
app.put('/api/products/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body;
  
  // Безопасная проверка разрешенных полей для защиты от SQL-инъекций
  const allowedFields = ['name', 'quantity', 'price', 'cost', 'categoryId', 'internalCode', 'govCode'];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ error: 'Недопустимое поле' });
  }

  try {
    // 1. Читаем старые данные
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

    // 2. Обновляем значение в базе
    await db.execute({
      sql: `UPDATE products SET ${field} = ? WHERE id = ?`,
      args: [value, id]
    });

    // 3. Записываем историю (только если значение изменилось)
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
    // Используем транзакцию из двух запросов
    await db.batch([
      { sql: 'DELETE FROM categories WHERE id = ?', args: [req.params.id] },
      { sql: 'UPDATE products SET categoryId = "" WHERE categoryId = ?', args: [req.params.id] }
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- ДОБАВИТЬ В SERVER.JS ---

// API: Массовое добавление товаров из Excel (Batch Import)
app.post('/api/products/batch', authenticate, async (req, res) => {
  const products = req.body;
  
  if (!Array.isArray(products)) return res.status(400).json({ error: 'Ожидается массив' });

  try {
    const statements = [];

    for (const p of products) {
      // 1. Ищем товар в базе по иерархии: Гос.Код -> Наименование -> Внутренний код
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

      // 2. Если нашли — обновляем, если нет — создаем новый
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

// Раздача интерфейса React
app.use(express.static(path.join(__dirname, 'dist')));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер работает на порту ${PORT}`));