// Genera los PDF de docs/manuales/pdf con el diseño de Ludoteka Campus (portada, encabezado y pie, índice y diagramas).
// Uso: npm run docs:pdf. Necesita internet para las fuentes de Google y Mermaid (CDN).
import { readFileSync, rmSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { chromium } from '@playwright/test';
import { Marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs', 'manuales');
const out = path.join(dir, 'pdf');
const REPO = 'https://github.com/Joan-Mora/ludoteka-campus/blob/main';
const EDITION = 'Versión 1.0 · octubre de 2026';
const TEAM = [
  ['Darwin Joan Aveiga Mora', 'Arquitectura y desarrollo full stack'],
  ['Mariana Sofía Azabache Moreno', 'Project manager, diseño UI/UX y frontend'],
  ['Julián Esteban Chávez Zamora', 'QA y apoyo en backend'],
];

const DOCS = [
  { src: 'manual-de-instalacion.md', pdf: 'Manual de Instalación.pdf', title: 'Manual de Instalación', kicker: 'Instalación y despliegue', accent: '#7ff0cf', breakSections: true,
    lead: 'Cómo preparar el entorno, configurar los servicios y poner en marcha Ludoteka Campus en desarrollo, Docker o producción.' },
  { src: 'manual-de-usuario.md', pdf: 'Manual de Usuario.pdf', title: 'Manual de Usuario', kicker: 'Uso del campus', accent: '#ffd66b', breakSections: true,
    lead: 'Guía paso a paso para estudiantes, docentes, coordinación, rectoría, familias y administración, con capturas de cada pantalla.' },
  { src: 'manual-tecnico.md', pdf: 'Manual Tecnico.pdf', title: 'Manual Técnico', kicker: 'Construcción y operación', accent: '#9fd8ff', breakSections: true,
    lead: 'Arquitectura, tecnologías, modelo de datos, configuración, mantenimiento y diagnóstico del sistema.' },
  { src: 'Architecture.md', pdf: 'Guia de Arquitectura.pdf', title: 'Guía de Arquitectura', kicker: 'Cómo está armado', accent: '#d9b8ff', breakSections: false,
    lead: 'Procesos, módulos, eventos, tiempo real, inteligencia artificial y las decisiones de diseño detrás de cada pieza.' },
  { src: 'Security.md', pdf: 'Manual de Seguridad.pdf', title: 'Manual de Seguridad', kicker: 'Protección de la plataforma', accent: '#ff8fa0', breakSections: false,
    lead: 'Autenticación, sesiones, autorización, protección web, biometría, datos personales y riesgos conocidos.' },
];
const pdfFor = new Map(DOCS.map((d) => [path.join(dir, d.src).toLowerCase(), d.pdf]));

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const slugOf = (text) => text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');

/** Screenshots are PNG; embedded as JPEG they keep the manual a few MB instead of ~20. Keyed by the Markdown href. */
async function jpegs(source) {
  const hrefs = new Set([...source.matchAll(/!\[[^\]]*\]\(([^)\s]+\.png)\)/gi)].map((m) => m[1]).filter((href) => !/^[a-z]+:/i.test(href)));
  const map = new Map();
  for (const href of hrefs) {
    const img = await loadImage(readFileSync(path.resolve(dir, decodeURI(href))));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    map.set(href, `data:image/jpeg;base64,${(await canvas.encode('jpeg', 84)).toString('base64')}`);
  }
  return map;
}

/** Relative links: other manuals point to their PDF, the rest of the repo to GitHub. */
function rewrite(href) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [rel, hash] = href.split('#');
  const target = path.resolve(dir, decodeURI(rel));
  const pdf = pdfFor.get(target.toLowerCase());
  if (pdf) return encodeURI(pdf) + (hash ? `#${hash}` : '');
  return `${REPO}/${path.relative(root, target).split(path.sep).map(encodeURIComponent).join('/')}${hash ? `#${hash}` : ''}`;
}

async function render(doc) {
  const source = readFileSync(path.join(dir, doc.src), 'utf8');
  const images = await jpegs(source);
  const seen = new Map();
  const outline = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const base = slugOf(plain(html));
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        if (depth === 2) outline.push({ id, text: plain(html) });
        return `<h${depth} id="${escape(id)}">${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        return `<a href="${escape(rewrite(href))}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, title, text }) {
        return `<img src="${escape(images.get(href) ?? href)}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ''}>`;
      },
      code({ text, lang }) {
        if (lang === 'mermaid') return `<pre class="mermaid">${escape(text)}</pre>\n`;
        return `<pre><code${lang ? ` class="language-${escape(lang)}"` : ''}>${escape(text)}</code></pre>\n`;
      },
      table(token) {
        const cell = (c, tag) => `<${tag}${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        const head = token.header.some((c) => c.text.trim()) ? `<thead><tr>${token.header.map((c) => cell(c, 'th')).join('')}</tr></thead>` : '';
        const images = token.rows.every((row) => row.every((c) => /^!\[/.test(c.text.trim())));
        return `<table class="${images ? 'shots' : ''}${head ? '' : ' facts'}">${head}<tbody>${token.rows.map((row) => `<tr>${row.map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody></table>\n`;
      },
    },
  });
  const tokens = marked.lexer(source);
  const first = tokens.findIndex((t) => t.type === 'heading' && t.depth === 1);
  if (first >= 0) tokens.splice(first, 1);
  const body = marked.parser(tokens);
  const hasToc = /^##\s+Contenido\s*$/m.test(source);
  const toc = hasToc ? '' : `<nav class="toc"><h2 class="toc-title">Contenido</h2><ol>${outline.map((h) => `<li><a href="#${escape(h.id)}">${escape(h.text)}</a></li>`).join('')}</ol></nav>`;
  return { body, toc };
}

const logo = readFileSync(path.join(root, 'apps/web/public/favicon.svg'), 'utf8').replace('id="g"', 'id="logo-g"').replace('url(#g)', 'url(#logo-g)');
const luka = pathToFileURL(path.join(root, 'apps/web/public/email/luka.png')).href;

function page(doc, { body, toc }) {
  const [lead, last] = [doc.title.split(' ').slice(0, -1).join(' '), doc.title.split(' ').at(-1)];
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${escape(doc.title)} · Ludoteka Campus</title>
<meta name="author" content="${TEAM.map(([name]) => name).join(', ')}">
<meta name="description" content="${escape(doc.lead)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
<style>
  :root { --ink: #16132d; --ink-2: #3d3a5c; --muted: #7a7799; --line: #e6e3f4; --violet: #7c5cff; --violet-2: #5b3df5; --coral: #ff5d73; --night: #140f2e; --soft: #f4f1ff; }
  @page {
    size: A4; margin: 24mm 18mm 20mm;
    @top-left { content: "Ludoteka Campus"; font: 700 8pt 'Bricolage Grotesque', sans-serif; color: #5b3df5; vertical-align: bottom; padding-bottom: 4mm; }
    @top-right { content: "${escape(doc.title)}"; font: 600 8pt 'Plus Jakarta Sans', sans-serif; color: #7a7799; vertical-align: bottom; padding-bottom: 4mm; }
    @bottom-left { content: "Colegio Francisco Arango"; font: 600 7.5pt 'Plus Jakarta Sans', sans-serif; color: #7a7799; vertical-align: top; padding-top: 4mm; }
    @bottom-right { content: counter(page) " / " counter(pages); font: 700 8pt 'Plus Jakarta Sans', sans-serif; color: #5b3df5; vertical-align: top; padding-top: 4mm; }
  }
  @page cover { margin: 0; @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 9.6pt; line-height: 1.6; color: var(--ink); }

  .cover { page: cover; position: relative; width: 210mm; height: 297mm; overflow: hidden; color: #fff; break-after: page;
    background: radial-gradient(160mm 120mm at 0% -10%, #3b2a8f 0%, transparent 65%), radial-gradient(140mm 110mm at 110% 20%, #7a1f5c 0%, transparent 60%), radial-gradient(120mm 90mm at 60% 115%, #2b1f7a 0%, transparent 70%), #140f2e; }
  .cover .dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.08) 1px, transparent 1.4px); background-size: 6mm 6mm;
    -webkit-mask-image: linear-gradient(160deg, #000 0%, rgba(0,0,0,.55) 45%, transparent 75%); }
  .cover .glow { position: absolute; width: 150mm; height: 150mm; right: -40mm; bottom: 10mm; border-radius: 50%; background: radial-gradient(circle, rgba(124,92,255,.42), transparent 65%); }
  .cover .star { position: absolute; width: 1.1mm; height: 1.1mm; border-radius: 50%; background: #fff; box-shadow: 0 0 2mm #fff; opacity: .7; }
  .cover .brand { position: absolute; left: 20mm; top: 20mm; display: flex; align-items: center; gap: 4mm; }
  .cover .brand svg { width: 15mm; height: 15mm; filter: drop-shadow(0 3mm 6mm rgba(124,92,255,.7)); }
  .cover .brand b { display: block; font: 800 15pt 'Bricolage Grotesque', sans-serif; letter-spacing: -.02em; }
  .cover .brand small { display: block; font-size: 8.5pt; font-weight: 700; color: #a79fe0; }
  .cover .copy { position: absolute; left: 20mm; right: 20mm; top: 78mm; }
  .cover .pill { display: inline-flex; align-items: center; gap: 2.5mm; padding: 1.8mm 4mm 1.8mm 3mm; border-radius: 99px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16);
    font-size: 8pt; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: ${doc.accent}; }
  .cover .pill i { width: 2.2mm; height: 2.2mm; border-radius: 50%; background: ${doc.accent}; box-shadow: 0 0 3mm ${doc.accent}; }
  .cover h1 { margin: 7mm 0 0; font: 800 44pt/0.98 'Bricolage Grotesque', sans-serif; letter-spacing: -.045em; }
  .cover h1 span { background: linear-gradient(135deg, #b9a8ff 0%, #f08bff 50%, #ff8fa0 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .cover .lead { margin: 7mm 0 0; max-width: 120mm; font-size: 12pt; line-height: 1.55; color: #d6d0ff; }
  .cover .luka { position: absolute; right: 16mm; bottom: 46mm; width: 62mm; max-height: none; margin: 0; border: 0; border-radius: 0; filter: drop-shadow(0 8mm 10mm rgba(0,0,0,.45)); }
  .cover .meta { position: absolute; left: 20mm; right: 90mm; bottom: 22mm; display: grid; gap: 4.5mm; }
  .cover .meta h4 { margin: 0 0 1.2mm; font-size: 7pt; letter-spacing: .18em; text-transform: uppercase; color: #a79fe0; font-weight: 800; }
  .cover .meta p { margin: 0; font-size: 9pt; line-height: 1.45; color: #fff; font-weight: 600; }
  .cover .meta p small { color: #b8b1e8; font-weight: 500; }
  .cover .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3mm; background: linear-gradient(90deg, #7c5cff 0%, #b24bf3 50%, #ff5d73 100%); }
  .cover > img.art { position: absolute; inset: 0; width: 100%; height: 100%; max-height: none; margin: 0; border: 0; border-radius: 0; box-shadow: none; }

  main { counter-reset: none; }
  h1, h2, h3, h4 { font-family: 'Bricolage Grotesque', sans-serif; letter-spacing: -.02em; line-height: 1.15; break-after: avoid; }
  h2 { position: relative; margin: 0 0 4.5mm; padding: 0 0 2.5mm; font-size: 19pt; font-weight: 800; color: var(--ink); border-bottom: .3mm solid var(--line); }
  h2::after { content: ''; position: absolute; left: 0; bottom: -.75mm; width: 42mm; height: 1.2mm; border-radius: 1mm; background: linear-gradient(90deg, #7c5cff, #b24bf3, #ff5d73); }
  ${doc.breakSections ? 'main > h2 { break-before: page; } main > h2:first-of-type { break-before: auto; }' : 'main > h2 { margin-top: 9mm; }'}
  h3 { margin: 6mm 0 2mm; font-size: 12.5pt; font-weight: 700; color: var(--violet-2); }
  h4 { margin: 4mm 0 1.5mm; font-size: 10.5pt; font-weight: 700; color: var(--ink); }
  p { margin: 0 0 2.6mm; orphans: 3; widows: 3; }
  strong { font-weight: 700; color: #241f4d; }
  a { color: var(--violet-2); text-decoration: none; font-weight: 600; }
  ul, ol { margin: 0 0 3mm; padding-left: 5.5mm; }
  li { margin: 0 0 1.2mm; }
  li::marker { color: var(--violet); font-weight: 700; }
  hr { border: 0; height: 1px; background: var(--line); margin: 6mm 0; }
  code { font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace; font-size: .86em; padding: .2mm 1.2mm; border-radius: 1.4mm; background: var(--soft); color: #4b2fd6; }
  pre { margin: 0 0 3.5mm; padding: 3.5mm 4mm; border-radius: 3mm; background: var(--night); color: #ebe7ff; font-size: 7.8pt; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
  pre code { padding: 0; background: none; color: inherit; font-size: 1em; }
  pre.mermaid { background: #fbfaff; color: var(--ink); border: 1px solid var(--line); text-align: center; white-space: pre; break-inside: avoid; }
  blockquote { margin: 0 0 3.5mm; padding: 3mm 4mm; border-left: 1.2mm solid var(--violet); border-radius: 0 3mm 3mm 0; background: var(--soft); color: var(--ink-2); }
  blockquote p:last-child { margin: 0; }
  table { width: 100%; margin: 0 0 4mm; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; font-size: 8.6pt; line-height: 1.45; }
  th { background: linear-gradient(135deg, #f1edff, #fbeaf4); color: #3a2a9c; font-weight: 800; text-align: left; font-size: 8pt; letter-spacing: .02em; }
  th, td { padding: 2mm 3mm; vertical-align: top; border-bottom: 1px solid var(--line); }
  tr:last-child td { border-bottom: 0; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #fbfaff; }
  table.facts td:first-child { width: 34%; font-weight: 700; color: #3a2a9c; background: #f7f5ff; }
  table.shots { border: 0; border-radius: 0; }
  table.shots th { background: none; color: var(--muted); text-align: center; }
  table.shots td { background: none !important; border: 0; padding: 1.5mm; text-align: center; }
  img { display: block; max-width: 100%; max-height: 98mm; margin: 2mm auto 4mm; border-radius: 2.5mm; border: .3mm solid #d8d2f2; break-inside: avoid; }
  table.shots img { max-height: 130mm; margin: 0 auto; }
  .toc { break-after: page; }
  .toc-title { margin-bottom: 5mm; }
  .toc ol { list-style: none; padding: 0; margin: 0; counter-reset: toc; }
  .toc li { counter-increment: toc; display: flex; gap: 3mm; padding: 2.4mm 0; border-bottom: 1px dashed var(--line); font-size: 10.5pt; }
  .toc li::before { content: counter(toc, decimal-leading-zero); font: 800 9pt 'Bricolage Grotesque', sans-serif; color: var(--violet); min-width: 7mm; }
  .toc a { color: var(--ink); font-weight: 600; }
</style></head>
<body>
<section class="cover">
  <div class="dots"></div><div class="glow"></div>
  <span class="star" style="left:120mm;top:30mm"></span><span class="star" style="left:150mm;top:52mm;opacity:.45"></span>
  <span class="star" style="left:182mm;top:24mm"></span><span class="star" style="left:166mm;top:110mm;opacity:.4"></span><span class="star" style="left:30mm;top:150mm;opacity:.35"></span>
  <div class="brand">${logo}<div><b>Ludoteka Campus</b><small>Colegio Francisco Arango</small></div></div>
  <div class="copy">
    <div class="pill"><i></i>${escape(doc.kicker)}</div>
    <h1>${escape(lead)}<br><span>${escape(last)}</span></h1>
    <p class="lead">${escape(doc.lead)}</p>
  </div>
  <img class="luka" src="${luka}" alt="">
  <div class="meta">
    <div><h4>Edición</h4><p>${escape(EDITION)}</p></div>
    <div><h4>Equipo</h4>${TEAM.map(([name, role]) => `<p>${escape(name)} <small>· ${escape(role)}</small></p>`).join('')}</div>
  </div>
  <div class="bar"></div>
</section>
${toc}
<main>
${body}
</main>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  window.mermaid?.initialize({
    startOnLoad: false,
    theme: 'base',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    themeVariables: { primaryColor: '#efeaff', primaryBorderColor: '#7c5cff', primaryTextColor: '#16132d', secondaryColor: '#ffe9f0', tertiaryColor: '#f6f4ff', lineColor: '#7a7799', fontSize: '13px', clusterBkg: '#f8f6ff', clusterBorder: '#d8d0ff' },
  });
</script>
</body></html>`;
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const doc of DOCS) {
    const html = path.join(dir, `.pdf-${path.parse(doc.src).name}.html`);
    writeFileSync(html, page(doc, await render(doc)));
    // A4 at 96 dpi with a high pixel ratio: the cover is rasterized because its translucent gradients and gradient text break in some PDF viewers.
    const tab = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2.5 });
    try {
      await tab.goto(pathToFileURL(html).href, { waitUntil: 'networkidle', timeout: 120_000 });
      await tab.evaluate(async () => {
        await document.fonts.ready;
        if (document.querySelector('pre.mermaid')) {
          if (!window.mermaid) throw new Error('Mermaid no cargó (¿sin internet?)');
          await window.mermaid.run({ querySelector: 'pre.mermaid' });
        }
        await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = resolve; }))));
      });
      const cover = tab.locator('.cover');
      const art = (await cover.screenshot({ type: 'jpeg', quality: 92 })).toString('base64');
      await cover.evaluate((node, src) => {
        node.replaceChildren(Object.assign(document.createElement('img'), { className: 'art', src, alt: node.innerText.replace(/\s+/g, ' ').trim() }));
      }, `data:image/jpeg;base64,${art}`);
      await tab.waitForFunction(() => document.querySelector('.cover img.art')?.complete);
      const file = path.join(out, doc.pdf);
      await tab.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true, outline: true, tagged: true });
      console.log(`${doc.pdf}: ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`);
    } finally {
      await tab.close();
      rmSync(html, { force: true });
    }
  }
} finally {
  await browser.close();
}
