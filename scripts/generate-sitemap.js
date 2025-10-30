import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SEO-optimized sitemap generator with proper priorities and change frequencies
const SITE_URL = 'https://cloudchicken.in';
const currentDate = new Date().toISOString();

const routes = [
  { path: '/', priority: '1.0', changefreq: 'daily', description: 'Homepage - Highest priority, updated frequently' },
  { path: '/menu', priority: '0.9', changefreq: 'daily', description: 'Menu page - High priority for food delivery business' },
  { path: '/login', priority: '0.7', changefreq: 'weekly', description: 'User authentication pages' },
  { path: '/signup', priority: '0.7', changefreq: 'weekly', description: '' },
  { path: '/cart', priority: '0.6', changefreq: 'weekly', description: 'Cart page - Important for conversions' },
  { path: '/about', priority: '0.5', changefreq: 'monthly', description: 'Legal and company info pages' },
  { path: '/privacy', priority: '0.3', changefreq: 'monthly', description: '' },
  { path: '/terms', priority: '0.3', changefreq: 'monthly', description: '' }
];

const urls = routes.map(route => {
  const comment = route.description ? `\n  <!-- ${route.description} -->` : '';
  return `${comment}\n  <url>\n    <loc>${SITE_URL}${route.path}</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>`;
}).join('\n  ');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`;

const outDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml);
console.log('Sitemap written to', path.join(outDir, 'sitemap.xml'));
