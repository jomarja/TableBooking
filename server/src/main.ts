import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5180', // local preview/verification instance
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`TableBooker API listening on http://localhost:${port}/api`);
}

bootstrap();
