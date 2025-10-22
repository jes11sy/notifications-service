import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}

