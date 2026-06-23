import express from 'express';
import cors from 'cors';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Настройка путей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Инициализация сервера (создаем тот самый app)
const app = express();
app.use(cors());
app.use(express.json());

const SHARED_PASSWORD = "Ваш_Секретный_Пароль_123"; // Можете поменять на свой

// 3. База данных
let db;
(async () => {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      color TEXT
    );
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
})();

// 4. Проверка пароля
const authenticate = (req, res, next) => {
  const password = req.headers['authorization'];
  if (password === SHARED_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Неверный пароль доступа' });
  }
};

// 5. Роуты (API)
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === SHARED_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Неверный пароль' });
  }
});

app.get('/api/data', authenticate, async (req, res) => {
  const products = await db.all('SELECT * FROM products');
  const categories = await db.all('SELECT * FROM categories');
  res.json({ products, categories });
});

app.post('/api/products', authenticate, async (req, res) => {
  const p = req.body;
  await db.run(
    `INSERT INTO products (id, name, internalCode, govCode, quantity, price, cost, categoryId) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.id, p.name, p.internalCode, p.govCode, p.quantity, p.price, p.cost, p.categoryId]
  );
  res.json({ success: true });
});

app.put('/api/products/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body;
  await db.run(`UPDATE products SET ${field} = ? WHERE id = ?`, [value, id]);
  res.json({ success: true });
});

app.delete('/api/products/:id', authenticate, async (req, res) => {
  await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// 6. Раздача интерфейса React (Тот самый кусок, который вызывал ошибку, теперь на своем месте)
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 7. Запуск сервера на порту Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));