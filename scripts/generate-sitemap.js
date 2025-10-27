const fs = require('fs');
const path = require('path');

// Basic sitemap generator for static routes. Extend to include product slugs later.
const SITE_URL = 'https://cloudchicken.in';
const routes = [
  '/',
  '/menu',
  '/login',
  '/signup',
  '/about',
  '/privacy',
  '/terms',
  '/contact'
];

const urls = routes.map(route => `  <url>\n    <loc>${SITE_URL}${route}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

const outDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml);
console.log('Sitemap written to', path.join(outDir, 'sitemap.xml'));
