import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Six decimal digits, uniformly distributed. */
export function otpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Readable temporary password: no ambiguous characters, always has letters and digits. */
export function temporaryPassword(): string {
  return `${shortCode(4)}-${shortCode(4)}-${randomInt(10, 100)}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function shortCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export function passwordIsStrong(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/** AES-256-GCM over a Float32 vector. `aad` binds the ciphertext to its owner so templates cannot be swapped between rows. */
export function encryptVector(key: Buffer, vector: number[], aad: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const plain = Buffer.from(new Float32Array(vector).buffer);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

export function decryptVector(key: Buffer, data: { ciphertext: Buffer; iv: Buffer; tag: Buffer }, aad: string): number[] {
  const decipher = createDecipheriv('aes-256-gcm', key, data.iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(data.tag);
  const plain = Buffer.concat([decipher.update(data.ciphertext), decipher.final()]);
  const aligned = new Uint8Array(plain);
  return Array.from(new Float32Array(aligned.buffer));
}
