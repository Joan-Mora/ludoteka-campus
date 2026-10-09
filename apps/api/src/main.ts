import 'reflect-metadata';
import { existsSync } from 'fs';
import path from 'path';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { loadEnv, repoRoot } from './core/config/env';
import { runMigrations } from './core/database/migrate';
import { seedIfEmpty } from './core/database/seed';
import { securityHeaders } from './core/security/headers';
import { RAW_UPLOAD_ROUTES } from './modules/identity/accounts.controller';

async function bootstrap() {
  const env = loadEnv();
  await runMigrations();
  await seedIfEmpty();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const http = app.getHttpAdapter().getInstance() as express.Express;
  http.set('trust proxy', 1);
  http.disable('x-powered-by');
  app.use(securityHeaders(env));
  app.use(cookieParser());
  app.use(RAW_UPLOAD_ROUTES, express.raw({ type: () => true, limit: '3mb' }));
  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((item) => item.trim()),
    credentials: true,
  });
  const webDist = path.join(repoRoot(), 'apps', 'web', 'dist');
  if (existsSync(webDist)) {
    http.use(express.static(webDist, { index: false }));
    http.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }
  await app.listen(env.PORT, '0.0.0.0');
  console.log(`Ludoteka Campus escuchando en 0.0.0.0:${env.PORT}`);
}

bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
