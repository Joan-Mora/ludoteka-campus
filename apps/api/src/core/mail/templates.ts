/** Branded transactional emails: table layout with inline styles so Gmail, Outlook and Apple Mail render them alike. */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  /** Files in `apps/web/public/email` referenced as `cid:<file>`; the mailer attaches them inline. */
  inline: string[];
}

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'code'; code: string; minutes: number }
  | { kind: 'button'; label: string; href: string }
  | { kind: 'facts'; rows: [string, string, boolean?][] }
  | { kind: 'steps'; title: string; items: string[] }
  | { kind: 'notice'; tone: 'warn' | 'info'; title: string; text: string }
  | { kind: 'campus' };

interface Layout {
  baseUrl: string;
  subject: string;
  preheader: string;
  banner: string;
  title: string;
  greeting: string;
  blocks: Block[];
  luka: string;
  recipientNote: string;
}

const C = {
  night: '#140f2e',
  violet: '#7c5cff',
  violet2: '#5b3df5',
  coral: '#ff5d73',
  gold: '#ffd66b',
  mint: '#19c39c',
  ink: '#16132d',
  ink2: '#3d3a5c',
  muted: '#7a7799',
  line: '#ebe8f6',
  bg: '#efedf8',
  soft: '#f7f5ff',
};
const FONT = "'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif";
const DISPLAY = "'Bricolage Grotesque','Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";
const GRAD = 'linear-gradient(135deg,#7c5cff 0%,#b24bf3 50%,#ff5d73 100%)';

const CAMPUS = [
  { icon: 'ico-biblioteca.png', title: 'Biblioteca', body: 'Guías y lecturas con marcadores y glosario.' },
  { icon: 'ico-laboratorio.png', title: 'Laboratorio IA', body: 'Un tutor que da pistas, no respuestas.' },
  { icon: 'ico-arena.png', title: 'Arena', body: 'Competencias por equipos con podio.' },
  { icon: 'ico-ruta.png', title: 'Mi ruta', body: 'Retos a la medida de lo que dominas.' },
];

function esc(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function img(file: string, width: number, height: number, alt: string, style = '') {
  return `<img src="cid:${file}" width="${width}" height="${height}" alt="${esc(alt)}" style="display:block;border:0;outline:none;text-decoration:none;${style}">`;
}

const label = (text: string) =>
  `<div style="font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:${C.muted};">${esc(text)}</div>`;

function chip(text: string, bg: string, color: string) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-family:${FONT};font-size:12px;font-weight:800;border-radius:999px;padding:6px 12px;margin:0 3px 6px;">${esc(text)}</span>`;
}

function block(b: Block): string {
  switch (b.kind) {
    case 'p':
      return `<p style="margin:0 0 18px;font-family:${FONT};font-size:15.5px;line-height:1.7;color:${C.ink2};">${esc(b.text)}</p>`;
    case 'code': {
      const digits = [...b.code]
        .map(
          (d, i) => `${i === 3 ? '<td class="lk-gap" style="width:14px;font-size:0;">&nbsp;</td>' : i ? '<td style="width:8px;font-size:0;">&nbsp;</td>' : ''}<td class="lk-digit" align="center" valign="middle" style="width:50px;height:64px;background:#ffffff;border:1.5px solid #d9d0ff;border-radius:14px;font-family:${DISPLAY};font-size:32px;font-weight:800;line-height:64px;color:${C.violet2};box-shadow:0 8px 18px -10px rgba(91,61,245,.55);">${esc(d)}</td>`,
        )
        .join('');
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 24px;"><tr><td align="center" style="background-color:${C.soft};background-image:linear-gradient(135deg,#f3efff 0%,#fbf0ff 55%,#fff1f3 100%);border:1px solid #e6defe;border-radius:22px;padding:26px 14px 20px;">
${label('Tu código de ingreso')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 18px;"><tr>${digits}</tr></table>
<div>${chip(`Vence en ${b.minutes} minutos`, '#fff3d6', '#8a5a00')}${chip('Sirve una sola vez', '#ece7ff', C.violet2)}${chip('Solo para ti', '#e3f8f1', '#0c6b54')}</div>
</td></tr></table>`;
    }
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;"><tr><td style="border-radius:16px;background-color:${C.violet};background-image:${GRAD};box-shadow:0 14px 26px -12px rgba(124,92,255,.9);">
<a href="${esc(b.href)}" style="display:inline-block;padding:16px 30px;font-family:${FONT};font-size:15.5px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:16px;">${esc(b.label)} &rarr;</a>
</td></tr></table>
<p style="margin:0 0 22px;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.muted};">Si el botón no funciona, copia este enlace en el navegador:<br><a href="${esc(b.href)}" style="color:${C.violet2};word-break:break-all;">${esc(b.href)}</a></p>`;
    case 'facts':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 22px;background:${C.soft};border:1px solid #e6defe;border-radius:18px;border-collapse:separate;">
<tr><td style="padding:16px 20px 4px;">${label('Tus datos de acceso')}</td></tr>${b.rows
        .map(
          ([name, value, mono]) => `<tr><td style="padding:10px 20px 12px;"><div style="font-family:${FONT};font-size:12.5px;font-weight:700;color:${C.muted};">${esc(name)}</div>
<div style="margin-top:4px;font-family:${mono ? MONO : FONT};font-size:${mono ? 19 : 15.5}px;font-weight:800;color:${mono ? C.violet2 : C.ink};word-break:break-all;${mono ? 'letter-spacing:1px;' : ''}">${esc(value)}</div></td></tr>`,
        )
        .join('')}<tr><td style="height:6px;font-size:0;">&nbsp;</td></tr></table>`;
    case 'steps':
      return `<div style="margin:6px 0 14px;font-family:${DISPLAY};font-size:17px;font-weight:800;color:${C.ink};">${esc(b.title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">${b.items
        .map(
          (item, i) => `<tr><td valign="top" style="padding:0 14px 14px 0;width:32px;"><div style="width:32px;height:32px;line-height:32px;border-radius:11px;background-color:${C.violet};background-image:${GRAD};color:#fff;text-align:center;font-family:${DISPLAY};font-size:15px;font-weight:800;">${i + 1}</div></td>
<td valign="top" style="padding:5px 0 14px;font-family:${FONT};font-size:14.5px;line-height:1.55;color:${C.ink2};">${esc(item)}</td></tr>`,
        )
        .join('')}</table>`;
    case 'notice': {
      const warn = b.tone === 'warn';
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;"><tr><td style="background:${warn ? '#fff4f6' : '#eefaf6'};border:1px solid ${warn ? '#ffd7de' : '#c9efe2'};border-radius:16px;padding:14px 18px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="top" style="padding:5px 12px 0 0;"><div style="width:10px;height:10px;border-radius:50%;background:${warn ? C.coral : C.mint};"></div></td><td>
<div style="font-family:${FONT};font-size:14px;font-weight:800;color:${warn ? '#9b1c33' : '#0c6b54'};">${esc(b.title)}</div>
<div style="font-family:${FONT};font-size:13.5px;line-height:1.55;color:${warn ? '#7a2a39' : '#245e50'};margin-top:3px;">${esc(b.text)}</div>
</td></tr></table></td></tr></table>`;
    }
    case 'campus': {
      const cell = (f: (typeof CAMPUS)[number]) => `<td class="lk-tile" valign="top" width="50%" style="padding:6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.line};border-radius:18px;"><tr><td style="padding:16px;">
${img(f.icon, 44, 44, '', 'border-radius:14px;')}
<div style="margin-top:12px;font-family:${DISPLAY};font-size:16px;font-weight:800;color:${C.ink};">${esc(f.title)}</div>
<div style="margin-top:4px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(f.body)}</div>
</td></tr></table></td>`;
      return `<div style="margin:10px 0 8px;font-family:${DISPLAY};font-size:17px;font-weight:800;color:${C.ink};">Lo que te espera en el campus</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr>${cell(CAMPUS[0]!)}${cell(CAMPUS[1]!)}</tr><tr>${cell(CAMPUS[2]!)}${cell(CAMPUS[3]!)}</tr></table>`;
    }
  }
}

function plain(b: Block): string {
  switch (b.kind) {
    case 'p':
      return b.text;
    case 'code':
      return `Tu código de ingreso: ${b.code}\nVence en ${b.minutes} minutos y sirve una sola vez.`;
    case 'button':
      return `${b.label}: ${b.href}`;
    case 'facts':
      return b.rows.map(([name, value]) => `${name}: ${value}`).join('\n');
    case 'steps':
      return [b.title, ...b.items.map((item, i) => `${i + 1}. ${item}`)].join('\n');
    case 'notice':
      return `${/[.?!]$/.test(b.title) ? b.title : `${b.title}.`} ${b.text}`;
    case 'campus':
      return `Lo que te espera en el campus:\n${CAMPUS.map((f) => `- ${f.title}: ${f.body}`).join('\n')}`;
  }
}

function render(layout: Layout): RenderedEmail {
  const base = layout.baseUrl.replace(/\/$/, '');
  const host = base.replace(/^https?:\/\//, '');
  const inline = [layout.banner, 'luka.png', 'logo.png', ...(layout.blocks.some((b) => b.kind === 'campus') ? CAMPUS.map((f) => f.icon) : [])];
  const dots = [C.violet, C.coral, C.gold, C.mint]
    .map((color, i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};${i ? 'margin-left:5px;' : ''}"></span>`)
    .join('');
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(layout.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{color-scheme:light only;supported-color-schemes:light only}
@media (max-width:620px){.lk-wrap{padding:0!important}.lk-card{border-radius:0!important}.lk-pad{padding-left:22px!important;padding-right:22px!important}.lk-banner{width:100%!important;height:auto!important}.lk-digit{width:40px!important;height:54px!important;line-height:54px!important;font-size:26px!important}.lk-gap{width:8px!important}.lk-tile{display:block!important;width:100%!important}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;">${esc(layout.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};background-image:radial-gradient(700px 320px at 50% 0%,#e2dbff 0%,rgba(226,219,255,0) 70%);">
<tr><td align="center" class="lk-wrap" style="padding:36px 12px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="lk-card" style="max-width:600px;background:#ffffff;border-radius:26px;overflow:hidden;box-shadow:0 40px 80px -40px rgba(40,22,120,.45),0 2px 8px rgba(22,19,45,.05);">
<tr><td style="background:${C.night};font-size:0;line-height:0;"><a href="${esc(base)}">${img(layout.banner, 600, 264, `Ludoteka Campus · ${layout.title}`, 'width:100%;max-width:600px;height:auto;')}</a></td></tr>
<tr><td class="lk-pad" style="padding:34px 40px 8px;">
<p style="margin:0 0 14px;font-family:${DISPLAY};font-size:23px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">${esc(layout.greeting)}</p>
${layout.blocks.map(block).join('\n')}
</td></tr>
<tr><td class="lk-pad" style="padding:6px 40px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="bottom" style="width:70px;padding-right:12px;">${img('luka.png', 70, 82, 'Luka')}</td>
<td valign="bottom" style="padding-bottom:16px;"><table role="presentation" cellpadding="0" cellspacing="0" style="background:${C.soft};border:1px solid #e6defe;border-radius:20px 20px 20px 6px;"><tr><td style="padding:13px 16px;">
<div style="font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${C.violet};">Luka · tu compañero IA</div>
<div style="margin-top:4px;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.ink2};">${esc(layout.luka)}</div>
</td></tr></table></td>
</tr></table>
</td></tr>
<tr><td class="lk-pad" style="background:${C.soft};border-top:1px solid ${C.line};padding:18px 40px;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.muted};">
<b style="color:${C.ink2};">Tu cuenta, protegida.</b> Ludoteka Campus nunca te pedirá tu contraseña ni tus códigos por correo, chat o teléfono.
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td align="center" style="padding:26px 18px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle">${img('logo.png', 30, 30, '', 'border-radius:9px;')}</td>
<td valign="middle" style="padding-left:9px;font-family:${DISPLAY};font-size:15px;font-weight:800;color:${C.ink};">Ludoteka Campus</td>
</tr></table>
<div style="margin-top:10px;font-size:0;line-height:0;">${dots}</div>
<div style="margin-top:12px;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted};">Aula virtual oficial del Colegio Francisco Arango.<br>Mensaje automático: por favor no respondas a este correo.</div>
<div style="margin-top:8px;font-family:${FONT};font-size:12px;"><a href="${esc(base)}" style="color:${C.violet2};text-decoration:none;font-weight:800;">${esc(host)}</a> &nbsp;·&nbsp; <a href="${esc(base)}/legal/privacidad" style="color:${C.muted};">Tratamiento de datos</a> &nbsp;·&nbsp; <a href="${esc(base)}/legal/terminos" style="color:${C.muted};">Términos</a></div>
<div style="margin-top:8px;font-family:${FONT};font-size:11.5px;color:#9a96b8;">${esc(layout.recipientNote)}</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    'LUDOTEKA CAMPUS · Colegio Francisco Arango',
    '',
    layout.title,
    '',
    layout.greeting,
    '',
    ...layout.blocks.map(plain).flatMap((part) => [part, '']),
    `Luka: ${layout.luka}`,
    '',
    'Ludoteka Campus nunca te pedirá tu contraseña ni tus códigos por correo, chat o teléfono.',
    '',
    '—',
    `${host} · Tratamiento de datos: ${base}/legal/privacidad`,
    layout.recipientNote,
  ].join('\n');
  return { subject: layout.subject, text, html, inline };
}

function labNotice(account: string): Block {
  return { kind: 'notice', tone: 'info', title: 'Cuenta de laboratorio', text: `Este mensaje es para ${account} y llegó al buzón del laboratorio porque esa cuenta no tiene un correo real.` };
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function loginCodeEmail(input: { baseUrl: string; fullName: string; account: string; code: string; minutes: number; forLab: boolean }): RenderedEmail {
  return render({
    baseUrl: input.baseUrl,
    subject: input.forLab ? `Código ${input.code} para ${input.account} · Ludoteka Campus` : `Tu código de ingreso: ${input.code}`,
    preheader: `Tu código es ${input.code}. Vence en ${input.minutes} minutos.`,
    banner: 'banner-code.jpg',
    title: 'Tu código para entrar al campus',
    greeting: `¡Hola, ${firstName(input.fullName)}!`,
    blocks: [
      { kind: 'p', text: 'Alguien (esperamos que tú) escribió tu contraseña en Ludoteka Campus. Para terminar de entrar, escribe este código en la pantalla de ingreso:' },
      { kind: 'code', code: input.code, minutes: input.minutes },
      ...(input.forLab ? [labNotice(input.account)] : []),
      { kind: 'notice', tone: 'warn', title: '¿No fuiste tú?', text: 'No compartas este código con nadie. Cambia tu contraseña desde Ajustes y avisa a la secretaría del colegio.' },
    ],
    luka: 'Si marcas «Recordar este dispositivo por 30 días», no te pediré código en este navegador durante ese tiempo. Solo en tus equipos personales.',
    recipientNote: `Enviado para la cuenta ${input.account}.`,
  });
}

export function passwordResetEmail(input: { baseUrl: string; fullName: string; link: string }): RenderedEmail {
  return render({
    baseUrl: input.baseUrl,
    subject: 'Recupera tu contraseña de Ludoteka Campus',
    preheader: 'Elige una contraseña nueva. El enlace vale una hora.',
    banner: 'banner-reset.jpg',
    title: 'Elige una contraseña nueva',
    greeting: `¡Hola, ${firstName(input.fullName)}!`,
    blocks: [
      { kind: 'p', text: 'Recibimos una solicitud para recuperar tu acceso a Ludoteka Campus. Pulsa el botón para elegir una contraseña nueva:' },
      { kind: 'button', label: 'Elegir mi contraseña', href: input.link },
      { kind: 'p', text: 'El enlace vale una hora y sirve una sola vez. Al cambiarla se cierran tus sesiones abiertas en otros dispositivos.' },
      { kind: 'notice', tone: 'warn', title: '¿No lo pediste?', text: 'Ignora este mensaje: tu contraseña actual sigue funcionando.' },
    ],
    luka: 'Una buena contraseña es una frase que solo tú recuerdes. Te espero de vuelta en el campus.',
    recipientNote: 'Recibes este correo porque alguien pidió recuperar el acceso de esta cuenta.',
  });
}

export function welcomeEmail(input: { baseUrl: string; fullName: string; account: string; password: string; forLab: boolean }): RenderedEmail {
  const base = input.baseUrl.replace(/\/$/, '');
  return render({
    baseUrl: input.baseUrl,
    subject: input.forLab ? `Cuenta de Ludoteka Campus para ${input.account}` : 'Tu cuenta de Ludoteka Campus',
    preheader: 'El colegio creó tu cuenta. Aquí tienes tus datos para el primer ingreso.',
    banner: 'banner-welcome.jpg',
    title: 'Te damos la bienvenida al campus',
    greeting: `¡Hola, ${firstName(input.fullName)}!`,
    blocks: [
      { kind: 'p', text: 'El Colegio Francisco Arango creó tu cuenta en Ludoteka Campus, el aula virtual donde cada edificio es una forma de aprender.' },
      { kind: 'facts', rows: [['Correo', input.account], ['Clave temporal', input.password, true]] },
      { kind: 'button', label: 'Entrar al campus', href: `${base}/ingresar` },
      { kind: 'steps', title: 'Tu primer ingreso, paso a paso', items: [
        'Entra con tu correo y la clave temporal.',
        'Te enviaremos un código de 6 dígitos a este correo para confirmar que eres tú.',
        'Elige tu propia contraseña. La clave temporal deja de servir en ese momento.',
        'Si quieres, activa Face ID, huella o Windows Hello desde Ajustes para entrar más rápido.',
      ] },
      { kind: 'campus' },
      ...(input.forLab ? [labNotice(input.account)] : []),
      { kind: 'notice', tone: 'warn', title: '¿No esperabas este correo?', text: 'Avisa a la secretaría del colegio y no uses estos datos.' },
    ],
    luka: 'Soy Luka, tu compañero IA. Cuando entres, búscame en el campus: te ayudo a estudiar con pistas, nunca con las respuestas.',
    recipientNote: `Cuenta creada por el colegio para ${input.account}.`,
  });
}
