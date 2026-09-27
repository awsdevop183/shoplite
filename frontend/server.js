// ShopLite frontend — tier 1 (presentation tier)
// A tiny static file server with zero npm dependencies.
// It also serves /config.js so the backend URL comes from the .env file,
// not hard-coded in the HTML.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'http://localhost:5000';
const PUBLIC_DIR = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/config.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'] });
    return res.end(`window.APP_CONFIG = ${JSON.stringify({ API_URL, FRONTEND_HOST: os.hostname() })};`);
  }

  const file = urlPath === '/' ? 'index.html' : urlPath;
  const filePath = path.join(PUBLIC_DIR, path.normalize(file));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ShopLite frontend listening on port ${PORT}`);
  console.log(`Browser will call the API at ${API_URL}`);
});
