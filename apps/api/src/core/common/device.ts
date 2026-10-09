/** Short human label for a session or trusted device, e.g. "Safari en iPhone". */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  const os = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua)) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
    : /CrOS/.test(ua) ? 'Chromebook'
    : /Linux/.test(ua) ? 'Linux'
    : 'dispositivo desconocido';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome|CriOS/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari'
    : 'Navegador';
  return `${browser} en ${os}`;
}

export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  const visible = name.slice(0, Math.min(2, Math.max(1, name.length - 1)));
  return `${visible}${'•'.repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}
