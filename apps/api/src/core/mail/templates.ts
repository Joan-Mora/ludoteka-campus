/** Branded transactional emails: table layout with inline styles so Gmail, Outlook and Apple Mail render them alike. */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'code'; code: string; note: string }
  | { kind: 'button'; label: string; href: string }
  | { kind: 'facts'; rows: [string, string, boolean?][] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'notice'; tone: 'warn' | 'info'; title: string; text: string };

interface Layout {
  baseUrl: string;
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  blocks: Block[];
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
  lavender: '#a79fe0',
  line: '#e6e3f4',
  bg: '#f4f3fb',
  soft: '#f8f7fe',
};
const FONT = "'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif";
const DISPLAY = "'Bricolage Grotesque','Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";
const GRAD = 'linear-gradient(135deg,#7c5cff 0%,#b24bf3 50%,#ff5d73 100%)';

function esc(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function block(b: Block): string {
  switch (b.kind) {
    case 'p':
      return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15.5px;line-height:1.65;color:${C.ink2};">${esc(b.text)}</p>`;
    case 'code':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr><td align="center" style="background:${C.soft};border:1px solid #e0d9ff;border-radius:18px;padding:22px 12px;">
<div style="font-family:${FONT};font-size:11.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${C.muted};">Tu código de ingreso</div>
<div class="lk-code" style="font-family:${MONO};font-size:40px;line-height:1.2;font-weight:800;letter-spacing:12px;padding-left:12px;color:${C.violet2};margin-top:6px;">${esc(b.code)}</div>
<div style="margin-top:12px;"><span style="display:inline-block;background:#fff3d6;color:#8a5a00;font-family:${FONT};font-size:12.5px;font-weight:700;border-radius:999px;padding:5px 12px;">${esc(b.note)}</span></div>
</td></tr></table>`;
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;"><tr><td style="border-radius:14px;background-color:${C.violet};background-image:${GRAD};box-shadow:0 10px 22px -10px rgba(124,92,255,.8);">
<a href="${esc(b.href)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px;">${esc(b.label)} &rarr;</a>
</td></tr></table>
<p style="margin:0 0 20px;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.muted};">Si el botón no funciona, copia este enlace en el navegador:<br><a href="${esc(b.href)}" style="color:${C.violet2};word-break:break-all;">${esc(b.href)}</a></p>`;
    case 'facts':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;border:1px solid ${C.line};border-radius:16px;border-collapse:separate;">${b.rows
        .map(
          ([label, value, mono], i) => `<tr><td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT};font-size:13px;font-weight:700;color:${C.muted};width:38%;">${esc(label)}</td>
<td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${mono ? MONO : FONT};font-size:${mono ? 16 : 14.5}px;font-weight:800;color:${mono ? C.violet2 : C.ink};word-break:break-all;">${esc(value)}</td></tr>`,
        )
        .join('')}</table>`;
    case 'steps':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">${b.items
        .map(
          (item, i) => `<tr><td valign="top" style="padding:0 12px 12px 0;width:30px;"><div style="width:28px;height:28px;line-height:28px;border-radius:9px;background-color:${C.violet};background-image:${GRAD};color:#fff;text-align:center;font-family:${DISPLAY};font-size:14px;font-weight:800;">${i + 1}</div></td>
<td valign="top" style="padding:3px 0 12px;font-family:${FONT};font-size:14.5px;line-height:1.55;color:${C.ink2};">${esc(item)}</td></tr>`,
        )
        .join('')}</table>`;
    case 'notice': {
      const warn = b.tone === 'warn';
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="background:${warn ? '#fff1f3' : '#eafaf5'};border-left:4px solid ${warn ? C.coral : C.mint};border-radius:12px;padding:14px 16px;">
<div style="font-family:${FONT};font-size:13.5px;font-weight:800;color:${warn ? '#9b1c33' : '#0c6b54'};">${esc(b.title)}</div>
<div style="font-family:${FONT};font-size:13.5px;line-height:1.55;color:${warn ? '#7a2a39' : '#245e50'};margin-top:3px;">${esc(b.text)}</div>
</td></tr></table>`;
    }
  }
}

function plain(b: Block): string {
  switch (b.kind) {
    case 'p':
      return b.text;
    case 'code':
      return `Tu código de ingreso: ${b.code}\n${b.note}`;
    case 'button':
      return `${b.label}: ${b.href}`;
    case 'facts':
      return b.rows.map(([label, value]) => `${label}: ${value}`).join('\n');
    case 'steps':
      return b.items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    case 'notice':
      return `${/[.?!]$/.test(b.title) ? b.title : `${b.title}.`} ${b.text}`;
  }
}

function render(layout: Layout): RenderedEmail {
  const base = layout.baseUrl.replace(/\/$/, '');
  const host = base.replace(/^https?:\/\//, '');
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(layout.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
@media (max-width:600px){.lk-wrap{padding:0!important}.lk-head{border-radius:0!important}.lk-body{border-radius:0!important}.lk-pad{padding-left:22px!important;padding-right:22px!important}.lk-code{font-size:32px!important;letter-spacing:8px!important}.lk-title{font-size:26px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;">${esc(layout.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" class="lk-wrap" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td class="lk-head lk-pad" style="background-color:${C.night};background-image:radial-gradient(520px 260px at 0% -30%,#3b2a8f 0%,rgba(59,42,143,0) 70%),radial-gradient(420px 240px at 110% 0%,#7a1f5c 0%,rgba(122,31,92,0) 65%);border-radius:24px 24px 0 0;padding:28px 32px 30px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><a href="${esc(base)}"><img src="${esc(base)}/email/logo.png" width="44" height="44" alt="Ludoteka Campus" style="display:block;border:0;border-radius:12px;"></a></td>
<td valign="middle" style="padding-left:12px;">
<div style="font-family:${DISPLAY};font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;line-height:1.1;">Ludoteka Campus</div>
<div style="font-family:${FONT};font-size:12px;font-weight:600;color:${C.lavender};margin-top:2px;">Colegio Francisco Arango</div>
</td></tr></table>
<div style="margin-top:28px;font-family:${FONT};font-size:11.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${C.gold};">${esc(layout.eyebrow)}</div>
<div class="lk-title" style="margin-top:8px;font-family:${DISPLAY};font-size:30px;line-height:1.12;font-weight:800;letter-spacing:-0.6px;color:#ffffff;">${esc(layout.title)}</div>
<div style="margin-top:16px;font-size:0;line-height:0;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${C.violet};"></span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${C.coral};margin-left:6px;"></span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${C.gold};margin-left:6px;"></span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${C.mint};margin-left:6px;"></span></div>
</td></tr>
<tr><td style="height:5px;line-height:5px;font-size:0;background-color:${C.violet};background-image:linear-gradient(90deg,#7c5cff 0%,#b24bf3 50%,#ff5d73 100%);">&nbsp;</td></tr>
<tr><td class="lk-body lk-pad" style="background:#ffffff;border-radius:0 0 24px 24px;padding:30px 32px 26px;box-shadow:0 30px 60px -30px rgba(40,22,120,.35);">
<p style="margin:0 0 14px;font-family:${DISPLAY};font-size:19px;font-weight:800;color:${C.ink};">${esc(layout.greeting)}</p>
${layout.blocks.map(block).join('\n')}
<p style="margin:8px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink2};">Nos vemos en el campus,<br><b style="color:${C.ink};">Luka y el equipo de Ludoteka Campus</b></p>
</td></tr>
<tr><td align="center" style="padding:22px 18px 8px;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted};">
<div style="font-weight:800;color:${C.ink2};">Ludoteka Campus · Colegio Francisco Arango</div>
<div>Aula virtual oficial del colegio. Mensaje automático: por favor no respondas a este correo.</div>
<div style="margin-top:6px;"><a href="${esc(base)}" style="color:${C.violet2};text-decoration:none;font-weight:700;">${esc(host)}</a> &nbsp;·&nbsp; <a href="${esc(base)}/legal/privacidad" style="color:${C.muted};">Tratamiento de datos</a> &nbsp;·&nbsp; <a href="${esc(base)}/legal/terminos" style="color:${C.muted};">Términos</a></div>
<div style="margin-top:8px;color:#9a96b8;">${esc(layout.recipientNote)}</div>
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
    'Nos vemos en el campus,',
    'Luka y el equipo de Ludoteka Campus',
    '',
    '—',
    `${host} · Tratamiento de datos: ${base}/legal/privacidad`,
    layout.recipientNote,
  ].join('\n');
  return { subject: layout.subject, text, html };
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
    eyebrow: 'Ingreso seguro',
    title: 'Tu código para entrar al campus',
    greeting: `¡Hola, ${firstName(input.fullName)}!`,
    blocks: [
      { kind: 'p', text: 'Alguien (esperamos que tú) escribió tu contraseña en Ludoteka Campus. Para terminar de entrar, escribe este código en la pantalla de ingreso:' },
      { kind: 'code', code: input.code, note: `Vence en ${input.minutes} minutos · sirve una sola vez` },
      ...(input.forLab ? [labNotice(input.account)] : []),
      { kind: 'notice', tone: 'warn', title: '¿No fuiste tú?', text: 'No compartas este código con nadie. Cambia tu contraseña desde Ajustes y avisa a la secretaría del colegio.' },
    ],
    recipientNote: `Enviado para la cuenta ${input.account}.`,
  });
}

export function passwordResetEmail(input: { baseUrl: string; fullName: string; link: string }): RenderedEmail {
  return render({
    baseUrl: input.baseUrl,
    subject: 'Recupera tu contraseña de Ludoteka Campus',
    preheader: 'Elige una contraseña nueva. El enlace vale una hora.',
    eyebrow: 'Recuperar acceso',
    title: 'Elige una contraseña nueva',
    greeting: `¡Hola, ${firstName(input.fullName)}!`,
    blocks: [
      { kind: 'p', text: 'Recibimos una solicitud para recuperar tu acceso a Ludoteka Campus. Pulsa el botón para elegir una contraseña nueva:' },
      { kind: 'button', label: 'Elegir mi contraseña', href: input.link },
      { kind: 'p', text: 'El enlace vale una hora y sirve una sola vez. Al cambiarla se cierran tus sesiones abiertas en otros dispositivos.' },
      { kind: 'notice', tone: 'warn', title: '¿No lo pediste?', text: 'Ignora este mensaje: tu contraseña actual sigue funcionando.' },
    ],
    recipientNote: 'Recibes este correo porque alguien pidió recuperar el acceso de esta cuenta.',
  });
}

export function welcomeEmail(input: { baseUrl: string; fullName: string; account: string; password: string; forLab: boolean }): RenderedEmail {
  const base = input.baseUrl.replace(/\/$/, '');
  return render({
    baseUrl: input.baseUrl,
    subject: input.forLab ? `Cuenta de Ludoteka Campus para ${input.account}` : 'Tu cuenta de Ludoteka Campus',
    preheader: 'El colegio creó tu cuenta. Aquí tienes tus datos para el primer ingreso.',
    eyebrow: 'Bienvenida',
    title: 'Te damos la bienvenida al campus',
    greeting: `¡Hola, ${firstName(input.fullName)}!`,
    blocks: [
      { kind: 'p', text: 'El Colegio Francisco Arango creó tu cuenta en Ludoteka Campus, el aula virtual donde cada edificio es una forma de aprender: biblioteca, arena por equipos, tutor IA y mucho más.' },
      { kind: 'facts', rows: [['Correo', input.account], ['Clave temporal', input.password, true]] },
      { kind: 'button', label: 'Entrar al campus', href: `${base}/ingresar` },
      { kind: 'steps', items: [
        'Entra con tu correo y la clave temporal.',
        'Te enviaremos un código de 6 dígitos a este correo para confirmar que eres tú.',
        'Elige tu propia contraseña. La clave temporal deja de servir en ese momento.',
        'Si quieres, activa Face ID, huella o Windows Hello desde Ajustes para entrar más rápido.',
      ] },
      ...(input.forLab ? [labNotice(input.account)] : []),
      { kind: 'notice', tone: 'warn', title: '¿No esperabas este correo?', text: 'Avisa a la secretaría del colegio y no uses estos datos.' },
    ],
    recipientNote: `Cuenta creada por el colegio para ${input.account}.`,
  });
}
