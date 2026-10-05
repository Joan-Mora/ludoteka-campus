import { HttpException } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super({ error: { code, message, ...(details ? { details } : {}) } }, status);
  }
}
