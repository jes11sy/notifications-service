import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // ✅ FIX #86: Фильтрация уровней логов в production
  const logLevels: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] = isProduction
    ? ['log', 'error', 'warn']
    : ['log', 'error', 'warn', 'debug', 'verbose'];

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    {
      logger: logLevels, // ✅ FIX #86: Применяем фильтрацию логов
    },
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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // для Swagger UI
        scriptSrc: ["'self'", "'unsafe-inline'"], // для Swagger UI
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  
  app.useGlobalFilters(new GlobalExceptionFilter());

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

