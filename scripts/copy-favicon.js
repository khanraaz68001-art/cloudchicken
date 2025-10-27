const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'assets', 'favicon.png');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'favicon.png');

if (!fs.existsSync(src)) {
  console.warn('Source favicon not found at', src);
  process.exit(0);
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied favicon from', src, 'to', dest);
