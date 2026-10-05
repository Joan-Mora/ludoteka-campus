import { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiError } from '../errors/api-error';

export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const parsed = this.schema.safeParse(value ?? {});
    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Datos inválidos');
    }
    return parsed.data;
  }
}

const IMAGE_KEYS = ['image', 'photo', 'selfie', 'picture', 'blob', 'dataurl', 'data_url', 'frame', 'jpeg', 'png', 'base64'];

export function rejectImageFields(body: unknown) {
  if (!body || typeof body !== 'object') return;
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (IMAGE_KEYS.includes(key.toLowerCase())) {
      throw new ApiError(400, 'IMAGE_NOT_ALLOWED', 'No se aceptan imágenes. Solo el vector calculado en el dispositivo.');
    }
  }
}
