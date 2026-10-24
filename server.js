// Tiny static file server so the site can run on Node hosting. No dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HIDDEN = new Set(['server.js', 'package.json', 'package-lock.json', 'README-DEPLOY.txt']);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { return send(res, 400, 'Bad request'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  const name = path.basename(file);
  if (!file.startsWith(ROOT + path.sep) || rel.split('/').some((s) => s.startsWith('.')) || HIDDEN.has(name)) return notFound(res);
  fs.readFile(file, (err, data) => {
    if (err) return notFound(res);
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=86400' });
    res.end(data);
  });
}).listen(process.env.PORT || 3000);

function notFound(res) {
  fs.readFile(path.join(ROOT, '404.html'), (err, data) => err ? send(res, 404, 'Not found') : send(res, 404, data, 'text/html; charset=utf-8'));
}
