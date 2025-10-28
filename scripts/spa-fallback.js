const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
const fallback = path.join(dist, '404.html');

if (!fs.existsSync(index)) {
  console.warn('No dist/index.html found — run build first');
  process.exit(0);
}

fs.copyFileSync(index, fallback);
console.log('Copied dist/index.html to dist/404.html for SPA fallback');
