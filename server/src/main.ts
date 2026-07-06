import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { CORS_ORIGINS } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy (Render, etc.): trust the first hop so req.ip and
  // per-IP rate limiting see the real client via X-Forwarded-For — otherwise
  // every request looks like it comes from the proxy's single IP.
  app.set('trust proxy', 1);

  // Security response headers. Allow images served from /uploads to be embedded
  // by the separate frontend origins (else the default same-origin policy blocks them).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Explicit, reviewable request-body caps. Multipart uploads go through multer
  // (with its own limits) and are unaffected by these JSON/urlencoded limits.
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: true, limit: '256kb' }));

  app.setGlobalPrefix('api');

  // Explicit allowlist (never origin reflection) — credentials are enabled.
  app.enableCors({ origin: CORS_ORIGINS, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties with no DTO decorator → blocks mass-assignment
      transform: true,
      // Left false intentionally: the SPAs occasionally send extra display-only
      // fields; whitelist already discards them without rejecting the request.
      forbidNonWhitelisted: false,
    }),
  );

  // Generic client errors in prod; full detail logged server-side.
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`TableBooker API listening on port ${port} (prefix /api)`);
}

bootstrap();
