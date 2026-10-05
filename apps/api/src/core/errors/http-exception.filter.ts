import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'error' in body) {
        res.status(exception.getStatus()).json(body);
        return;
      }
      const message = typeof body === 'string' ? body : exception.message;
      res.status(exception.getStatus()).json({ error: { code: 'HTTP_ERROR', message } });
      return;
    }
    const message = exception instanceof Error ? exception.message : 'error';
    this.logger.error(message);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Error interno' } });
  }
}
