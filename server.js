const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(__dirname, reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('================================================================');
    console.log(`Port ${PORT} sudah aktif berjalan di latar belakang!`);
    console.log(`Membuka browser otomatis ke: http://localhost:${PORT}`);
    console.log('================================================================');
    exec(`start http://localhost:${PORT}`);
    setTimeout(() => process.exit(0), 1000);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`MAH POS Lokal berjalan di: http://localhost:${PORT}`);
  console.log('Membuka browser otomatis...');
  console.log('Tekan Ctrl + C di terminal ini jika ingin menghentikan server.');
  console.log('================================================================');
  exec(`start http://localhost:${PORT}`);
});
