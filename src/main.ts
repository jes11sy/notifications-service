import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
  );

  const logger = new Logger('NotificationsService');

  // 🍪 РЕГИСТРАЦИЯ COOKIE PLUGIN (до CORS!)
  await app.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET,
  });
  logger.log('✅ Cookie plugin registered');

  await app.register(require('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Use-Cookies', // 🍪 Поддержка cookie mode
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Notifications Service API')
    .setDescription('Telegram and other notifications channels')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.setGlobalPrefix('api/v1', {
    exclude: ['api/health'],
  });

  const port = process.env.PORT || 5008;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Notifications Service running on http://localhost:${port}`);
  logger.log(`📱 Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Not configured'}`);
}

bootstrap();

