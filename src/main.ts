import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Railway terminates TLS one hop in front of us. Without this, req.ip is the
  // proxy's address: the throttler buckets every user together and consentIp
  // records the proxy instead of the patient.
  app.set('trust proxy', 1);

  // No ETags: this API serves PHI, and conditional revalidation buys little on
  // small JSON payloads. With an ETag present Express answers a matching
  // If-None-Match with a 304 regardless of the response's Cache-Control, so
  // already-warm browser caches would keep revalidating against stale entries.
  app.set('etag', false);

  // Enable CORS for all origins
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

        // HTTPS PROD
        'https://dra-ruiz-ai.vercel.app',
        'https://admin-healthymind-new-version.vercel.app',
        'https://healthymind-newversion.vercel.app',

        // HTTPS RAILWAY
        'https://ai-frontend-production-9841.up.railway.app',
      ];

      // Permitir todos los subdominios de almaymente.io (con o sin www)
      const almaymenteRegex = /^https:\/\/([\w-]+\.)?almaymente\.io$/;
      const healthyMindRegex =
        /^https:\/\/([\w-]+\.)?healthymindspecialists\.com$/;

      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        almaymenteRegex.test(origin) ||
        healthyMindRegex.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  await app.listen(configService.get<number>('PORT', 4000));
}
bootstrap();
