import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Env } from '../../core/config/config.module';

interface Credentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export const LIBRARY_FOLDER = 'ludoteka/biblioteca';

/** Minimal signed-upload client. The browser uploads straight to Cloudinary; the API only signs and verifies. */
@Injectable()
export class Cloudinary {
  private readonly logger = new Logger('Cloudinary');
  private readonly creds: Credentials | null;

  constructor(env: Env) {
    this.creds = parseUrl(env.values.CLOUDINARY_URL);
  }

  get enabled() {
    return Boolean(this.creds);
  }

  private require(): Credentials {
    if (!this.creds) throw new Error('CLOUDINARY_URL no está configurada');
    return this.creds;
  }

  sign(params: Record<string, string | number>) {
    const { apiSecret } = this.require();
    const payload = Object.keys(params)
      .filter((key) => params[key] !== '' && params[key] !== undefined)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(payload + apiSecret).digest('hex');
  }

  /** Parameters the browser posts with the file. PDFs and documents go as `raw` so delivery is never transformed. */
  uploadTicket(resourceType: 'auto' | 'raw') {
    const { cloudName, apiKey } = this.require();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder: LIBRARY_FOLDER, timestamp, use_filename: 'true', unique_filename: 'true' };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      fields: { ...params, api_key: apiKey, signature: this.sign(params) },
      maxBytes: 52428800,
    };
  }

  /** Cloudinary signs every upload response with sha1("public_id=…&version=…" + secret). */
  verifyUpload(publicId: string, version: string | number, signature: string) {
    const expected = this.sign({ public_id: publicId, version });
    return expected === signature && publicId.startsWith(`${LIBRARY_FOLDER}/`);
  }

  /** Server-side signed upload: seeded guides and the covers of external resources. */
  uploadBuffer(file: Buffer | Uint8Array, filename: string, mime: string) {
    return this.upload((form) => form.append('file', new Blob([new Uint8Array(file)], { type: mime }), filename));
  }

  /** Cloudinary downloads the file itself; used for the og:image of linked pages. */
  uploadRemote(url: string) {
    return this.upload((form) => form.append('file', url));
  }

  private async upload(attach: (form: FormData) => void) {
    const { cloudName, apiKey } = this.require();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder: LIBRARY_FOLDER, timestamp, use_filename: 'true', unique_filename: 'true' };
    const form = new FormData();
    attach(form);
    for (const [key, value] of Object.entries(params)) form.append(key, String(value));
    form.append('api_key', apiKey);
    form.append('signature', this.sign(params));
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Cloudinary respondió ${response.status}`);
    return (await response.json()) as {
      public_id: string; version: number; signature: string; secure_url: string; resource_type: 'image' | 'video' | 'raw';
      format?: string; bytes: number; etag?: string; pages?: number;
    };
  }

  async destroy(publicId: string, resourceType: string) {
    if (!this.creds) return;
    const timestamp = Math.floor(Date.now() / 1000);
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: this.creds.apiKey,
      signature: this.sign({ public_id: publicId, timestamp }),
    });
    try {
      await fetch(`https://api.cloudinary.com/v1_1/${this.creds.cloudName}/${resourceType}/destroy`, { method: 'POST', body, signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      this.logger.warn(`No se pudo borrar ${publicId}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

function parseUrl(raw: string): Credentials | null {
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(raw.trim());
  if (!match) return null;
  return { apiKey: match[1]!, apiSecret: match[2]!, cloudName: match[3]!.replace(/\/.*$/, '') };
}
