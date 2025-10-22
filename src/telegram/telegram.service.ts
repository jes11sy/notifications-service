import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiUrl: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.apiUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
    
    if (!this.botToken) {
      this.logger.warn('⚠️ TELEGRAM_BOT_TOKEN not configured');
    } else {
      this.logger.log('✅ Telegram Bot configured');
    }
  }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.botToken) {
      this.logger.error('Telegram bot token not configured');
      return false;
    }

    try {
      const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;
      
      const response = await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }, {
        timeout: 10000,
      });

      if (response.data.ok) {
        this.logger.log(`✅ Message sent to chat ${chatId}`);
        return true;
      } else {
        this.logger.error(`❌ Failed to send message: ${response.data.description}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ Error sending Telegram message: ${error.message}`);
      return false;
    }
  }

  async getMe(): Promise<any> {
    try {
      const url = `${this.apiUrl}/bot${this.botToken}/getMe`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      this.logger.error(`Error getting bot info: ${error.message}`);
      throw error;
    }
  }

  formatMessage(template: string, data: Record<string, any>): string {
    let message = template;
    
    // Заменяем плейсхолдеры на данные
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return message;
  }
}

