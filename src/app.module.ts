import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TelegramModule } from './telegram/telegram.module';
import { DirectorsModule } from './directors/directors.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    NotificationsModule,
    TelegramModule,
    DirectorsModule,
    TemplatesModule,
  ],
})
export class AppModule {}

