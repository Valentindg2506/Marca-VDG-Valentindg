// Genera las imágenes de marca (logos en PNG, avatar de GitHub e iconos web) a partir del logo.
//   npm i playwright-core && node design-system/build-assets.mjs
// Usa el Chrome instalado (CHROME=/ruta/al/chrome para otro).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = { night: '#0d0f1a', ink: '#1d1c22' };

const read = p => fs.readFileSync(path.join(ROOT, p));
const b64 = (p, type) => `data:${type};base64,${read(p).toString('base64')}`;
const glow = b64('assets/logo/vdg-original.webp', 'image/webp');
const flat = color => b64(`assets/logo/vdg-${color}.svg`, 'image/svg+xml');

const night = inner => `<div style="width:100%;height:100%;background:radial-gradient(ellipse at 50% 42%,#1a2050 0%,${C.night} 68%);display:grid;place-items:center">${inner}</div>`;
const img = (src, width) => `<img src="${src}" style="width:${width};display:block">`;

const ASSETS = [
  // Logos en PNG (transparentes) para documentos y presentaciones
  ['logo/vdg-tinta.png', 2400, 837, img(flat('tinta'), '100%'), true],
  ['logo/vdg-blanco.png', 2400, 837, img(flat('blanco'), '100%'), true],
  ['logo/vdg-horizontal-tinta.png', 2400, 378, img(flat('horizontal-tinta'), '100%'), true],
  ['logo/vdg-horizontal-blanco.png', 2400, 378, img(flat('horizontal-blanco'), '100%'), true],
  ['logo/vdg-original-fondo-noche.png', 2400, 1260, night(img(glow, '62%'))],
  // GitHub
  ['aplicaciones/github/avatar.png', 500, 500, night(img(glow, '78%'))],
  // Web
  ['aplicaciones/web/favicon-32.png', 32, 32, `<div style="width:32px;height:32px;border-radius:7px;background:${C.ink};display:grid;place-items:center">${img(flat('blanco'), '24px')}</div>`, true],
  ['aplicaciones/web/apple-touch-icon.png', 180, 180, night(img(glow, '76%'))]
];

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const [file, width, height, body, transparent] of ASSETS) {
  const out = path.join(ROOT, 'assets', file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<style>*{margin:0}html,body{width:${width}px;height:${height}px;overflow:hidden;background:transparent}</style>${body}`);
  await page.screenshot({ path: out, omitBackground: Boolean(transparent) });
  await page.close();
  console.log(`${file.padEnd(48)} ${width}×${height}`);
}
await browser.close();

// Favicon SVG: la versión de una tinta sobre un cuadrado oscuro, legible a 16 px.
const logo = read('assets/logo/vdg-blanco.svg').toString();
fs.writeFileSync(path.join(ROOT, 'assets/aplicaciones/web/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${C.ink}"/><svg x="4" y="4" width="24" height="24" viewBox="${logo.match(/viewBox="([^"]+)"/)[1]}">${logo.match(/<path[^>]+\/>/)[0]}</svg></svg>\n`);
