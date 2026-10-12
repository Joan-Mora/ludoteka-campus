// Renders the artwork embedded in transactional emails (inline CID attachments) from the live landing.
// Usage: start `npm run dev`, then `node apps/web/scripts/email-assets.mjs [baseUrl]`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../public/email');
mkdirSync(out, { recursive: true });

const icons = [
  { file: 'ico-biblioteca.png', index: 1 },
  { file: 'ico-laboratorio.png', index: 2 },
  { file: 'ico-arena.png', index: 3 },
  { file: 'ico-ruta.png', index: 5 },
];

const banners = [
  { file: 'banner-code.jpg', eyebrow: 'Ingreso seguro', title: 'Tu código para<br>entrar al campus', accent: '#ffd66b' },
  { file: 'banner-reset.jpg', eyebrow: 'Recuperar acceso', title: 'Elige una<br>contraseña nueva', accent: '#ff8fa0' },
  { file: 'banner-welcome.jpg', eyebrow: 'Tu cuenta está lista', title: 'Bienvenida<br>al campus', accent: '#7ff0cf' },
  { file: 'banner-meeting.jpg', eyebrow: 'Citación del colegio', title: 'Te esperamos<br>en el colegio', accent: '#ffd66b' },
  { file: 'banner-message.jpg', eyebrow: 'Mensaje nuevo', title: 'Tienes un<br>mensaje nuevo', accent: '#9fd8ff' },
  { file: 'banner-digest.jpg', eyebrow: 'Resumen semanal', title: 'Tu resumen<br>de la semana', accent: '#7ff0cf' },
];

const isolate = (selector) => `
  html, body, #root, .landing { background: transparent !important; }
  body * { visibility: hidden !important; }
  ${selector}, ${selector} * { visibility: visible !important; }
  .luka-bubble, .luka-bubble * { visibility: hidden !important; }
`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark', reducedMotion: 'reduce' });
const page = await context.newPage();
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const campus = page.locator('.hero-campus > div').first();
let style = await page.addStyleTag({ content: isolate('.hero-campus > div:first-child') });
const campusPng = await campus.screenshot({ omitBackground: true, animations: 'disabled' });
await style.evaluate((node) => node.remove());

const luka = page.locator('.hero-luka svg.luka').first();
style = await page.addStyleTag({ content: isolate('.hero-luka svg.luka') });
writeFileSync(path.join(out, 'luka.png'), await luka.screenshot({ omitBackground: true, animations: 'disabled' }));
await style.evaluate((node) => node.remove());

for (const icon of icons) {
  const target = page.locator('.building-ico').nth(icon.index);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  style = await page.addStyleTag({ content: isolate('.building-ico') });
  writeFileSync(path.join(out, icon.file), await target.screenshot({ omitBackground: true, animations: 'disabled' }));
  await style.evaluate((node) => node.remove());
}

const logo = readFileSync(path.resolve(here, '../public/icon-192.png')).toString('base64');
const campusUrl = `data:image/png;base64,${campusPng.toString('base64')}`;

const banner = (b) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 600px; height: 264px; overflow: hidden; }
  .b { position: relative; width: 600px; height: 264px; overflow: hidden; color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
    background: radial-gradient(520px 300px at 0% -25%, #3b2a8f 0%, transparent 70%), radial-gradient(420px 280px at 105% 15%, #7a1f5c 0%, transparent 62%), #140f2e; }
  .dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.09) 1px, transparent 1.4px); background-size: 18px 18px;
    -webkit-mask-image: linear-gradient(100deg, #000 0%, rgba(0,0,0,.5) 45%, transparent 70%); }
  .glow { position: absolute; width: 300px; height: 300px; right: -40px; top: 10px; border-radius: 50%; background: radial-gradient(circle, rgba(124,92,255,.45), transparent 65%); filter: blur(8px); }
  .campus { position: absolute; right: -22px; top: 14px; width: 330px; filter: drop-shadow(0 22px 30px rgba(0,0,0,.45)); }
  .star { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #fff; opacity: .7; box-shadow: 0 0 6px #fff; }
  .copy { position: absolute; left: 34px; top: 30px; width: 300px; }
  .brand { display: flex; align-items: center; gap: 11px; }
  .brand img { width: 40px; height: 40px; border-radius: 12px; box-shadow: 0 8px 20px -6px rgba(124,92,255,.85); }
  .name { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 19px; letter-spacing: -.03em; line-height: 1.05; }
  .sub { font-size: 11px; font-weight: 700; color: #a79fe0; margin-top: 2px; }
  .pill { display: inline-flex; align-items: center; gap: 7px; margin-top: 30px; padding: 6px 12px 6px 9px; border-radius: 99px;
    background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: ${b.accent}; }
  .pill i { width: 7px; height: 7px; border-radius: 50%; background: ${b.accent}; box-shadow: 0 0 10px ${b.accent}; }
  h1 { margin-top: 14px; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 33px; line-height: 1.02; letter-spacing: -.045em; }
  h1 span { background: linear-gradient(135deg, #b9a8ff 0%, #f08bff 50%, #ff8fa0 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: linear-gradient(90deg, #7c5cff 0%, #b24bf3 50%, #ff5d73 100%); }
</style></head><body><div class="b">
  <div class="dots"></div><div class="glow"></div>
  <span class="star" style="left:360px;top:30px"></span><span class="star" style="left:430px;top:18px;opacity:.45"></span>
  <span class="star" style="left:560px;top:40px"></span><span class="star" style="left:395px;top:70px;opacity:.4"></span>
  <img class="campus" src="${campusUrl}">
  <div class="copy">
    <div class="brand"><img src="data:image/png;base64,${logo}"><div><div class="name">Ludoteka Campus</div><div class="sub">Colegio Francisco Arango</div></div></div>
    <div class="pill"><i></i>${b.eyebrow}</div>
    <h1>${b.title.replace(/<br>(.*)$/, '<br><span>$1</span>')}</h1>
  </div>
  <div class="bar"></div>
</div></body></html>`;

const composer = await context.newPage();
await composer.setViewportSize({ width: 600, height: 264 });
for (const b of banners) {
  await composer.setContent(banner(b), { waitUntil: 'networkidle' });
  await composer.evaluate(() => document.fonts.ready);
  writeFileSync(path.join(out, b.file), await composer.screenshot({ type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 600, height: 264 } }));
}

await browser.close();
console.log(`assets en ${out}`);
