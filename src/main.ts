import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS for localhost (HTTP and HTTPS)
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        // HTTP localhost
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:4200',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://localhost:4321',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:4200',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:4321',

        // HTTPS RAILWAY
        'https://admin-healthymind-new-version.vercel.app',
        'https://healthymind-newversion.vercel.app',
      ];

      // Permitir todos los subdominios de almaymente.io (con o sin www)
      const almaymenteRegex = /^https:\/\/([\w-]+\.)?almaymente\.io$/;

      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        almaymenteRegex.test(origin)
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        callback(null, true);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  await app.listen(configService.get<number>('PORT', 3000));
}
bootstrap();
