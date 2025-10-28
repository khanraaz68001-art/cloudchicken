import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dist = path.join(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
const fallback = path.join(dist, '404.html');

if (!fs.existsSync(index)) {
  console.warn('No dist/index.html found — run build first');
  process.exit(0);
}

fs.copyFileSync(index, fallback);
console.log('Copied dist/index.html to dist/404.html for SPA fallback');
