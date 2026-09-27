// ShopLite backend — tier 2 (application / API tier)
// Talks to MySQL (tier 3) and serves JSON to the browser (tier 1).

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const os = require('os');

const PORT = process.env.PORT || 5000;

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'shopuser',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shoplite',
  connectionLimit: 5,
  connectTimeout: 5000,
});

const app = express();
app.use(cors());          // the frontend lives on a different server, so allow cross-origin calls
app.use(express.json());

// Log every request — handy to show with: journalctl -u shoplite-backend -f
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'ShopLite API is running', try: ['/api/health', '/api/products'] });
});

// Health check: shows which server answered and whether the database is reachable.
app.get('/api/health', async (req, res) => {
  const result = {
    backend: { status: 'up', hostname: os.hostname() },
    database: { status: 'down', host: process.env.DB_HOST || 'localhost' },
  };
  try {
    const [rows] = await db.query('SELECT VERSION() AS version');
    result.database.status = 'up';
    result.database.version = rows[0].version;
    res.json(result);
  } catch (err) {
    result.database.error = err.code || err.message;
    res.status(503).json(result);
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, price, stock FROM products ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error: ' + (err.code || err.message) });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, price, stock } = req.body || {};
  if (!name || price === undefined || isNaN(Number(price))) {
    return res.status(400).json({ error: 'name and a numeric price are required' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)',
      [String(name).slice(0, 100), Number(price), Number(stock) || 0]
    );
    res.status(201).json({ id: result.insertId, name, price: Number(price), stock: Number(stock) || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error: ' + (err.code || err.message) });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: Number(req.params.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error: ' + (err.code || err.message) });
  }
});

// 0.0.0.0 = listen on all network interfaces, so it is reachable via the EC2 public IP
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShopLite backend listening on port ${PORT}`);
  console.log(`Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
});
