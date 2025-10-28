import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, '..', 'src', 'assets', 'favicon.png');
const destDir = path.join(__dirname, '..', 'public');
const destPng = path.join(destDir, 'favicon.png');
const destIco = path.join(destDir, 'favicon.ico');

if (!fs.existsSync(src)) {
  console.warn('Source favicon not found at', src);
  process.exit(0);
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, destPng);
// Also copy to favicon.ico to overwrite any previous ICO (some browsers request /favicon.ico early)
try {
  fs.copyFileSync(src, destIco);
} catch (e) {
  // non-fatal
}
console.log('Copied favicon from', src, 'to', destPng, 'and', destIco);
