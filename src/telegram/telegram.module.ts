import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { SiteOrdersParserService } from './site-orders-parser.service';

@Module({
  controllers: [TelegramController],
  providers: [TelegramService, SiteOrdersParserService],
  exports: [TelegramService, SiteOrdersParserService],
})
export class TelegramModule {}

