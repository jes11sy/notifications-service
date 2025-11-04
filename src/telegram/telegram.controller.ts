import { Controller, Post, Body, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private telegramService: TelegramService) {}

  /**
   * Webhook endpoint для Telegram Bot API
   * Принимает обновления от Telegram
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Скрываем из Swagger (внутренний endpoint)
  async handleWebhook(@Body() update: any) {
    this.logger.debug(`Received webhook update: ${JSON.stringify(update)}`);
    await this.telegramService.handleUpdate(update);
    return { ok: true };
  }

  /**
   * Установить webhook
   */
  @Post('webhook/set')
  @ApiOperation({ summary: 'Set Telegram webhook URL' })
  async setWebhook(@Body() body: { url: string }) {
    const result = await this.telegramService.setWebhook(body.url);
    return {
      success: result,
      message: result ? 'Webhook set successfully' : 'Failed to set webhook',
    };
  }

  /**
   * Удалить webhook
   */
  @Post('webhook/delete')
  @ApiOperation({ summary: 'Delete Telegram webhook' })
  async deleteWebhook() {
    const result = await this.telegramService.deleteWebhook();
    return {
      success: result,
      message: result ? 'Webhook deleted successfully' : 'Failed to delete webhook',
    };
  }

  /**
   * Получить информацию о webhook
   */
  @Get('webhook/info')
  @ApiOperation({ summary: 'Get Telegram webhook info' })
  async getWebhookInfo() {
    try {
      const info = await this.telegramService.getWebhookInfo();
      return {
        success: true,
        data: info,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Получить информацию о боте
   */
  @Get('me')
  @ApiOperation({ summary: 'Get bot information' })
  async getMe() {
    try {
      const info = await this.telegramService.getMe();
      return {
        success: true,
        data: info.result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

