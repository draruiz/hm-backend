import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS for all origins (development/testing only)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(configService.get<number>('PORT', 3000));
}
bootstrap();
