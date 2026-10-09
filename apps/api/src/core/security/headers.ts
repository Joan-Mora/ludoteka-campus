import type { RequestHandler } from 'express';
import helmet from 'helmet';
import type { AppEnv } from '../config/env';

const CLOUDINARY = 'https://res.cloudinary.com';

/**
 * Strict CSP: scripts only from our origin (no inline, no eval). Styles allow inline because React
 * and Framer Motion write style attributes; fonts come from Google Fonts and media from Cloudinary.
 */
export function securityHeaders(env: AppEnv): RequestHandler {
  const publicUrl = new URL(env.APP_PUBLIC_URL);
  const https = publicUrl.protocol === 'https:';
  const socket = `${https ? 'wss' : 'ws'}://${publicUrl.host}`;
  const permissions = [
    'camera=(self)',
    'microphone=(self)',
    'fullscreen=(self)',
    'publickey-credentials-get=(self)',
    'publickey-credentials-create=(self)',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'serial=()',
    'bluetooth=()',
    'browsing-topics=()',
  ].join(', ');

  const base = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', CLOUDINARY, 'https://img.youtube.com'],
        mediaSrc: ["'self'", 'blob:', CLOUDINARY],
        connectSrc: ["'self'", socket, 'https://api.cloudinary.com'],
        frameSrc: [CLOUDINARY, 'https://www.youtube-nocookie.com'],
        workerSrc: ["'self'", 'blob:'],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(https ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: https ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: false,
  });

  return (req, res, next) => {
    res.setHeader('Permissions-Policy', permissions);
    base(req, res, next);
  };
}
