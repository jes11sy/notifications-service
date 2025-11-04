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

  async sendMessage(chatId: string, text: string, buttons?: Array<{text: string, url: string}>): Promise<boolean> {
    if (!this.botToken) {
      this.logger.error('Telegram bot token not configured');
      return false;
    }

    try {
      const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;
      
      const payload: any = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      };

      // Добавляем inline кнопки если есть
      if (buttons && buttons.length > 0) {
        payload.reply_markup = {
          inline_keyboard: [
            buttons.map(btn => ({
              text: btn.text,
              url: btn.url,
            }))
          ]
        };
      }

      const response = await axios.post(url, payload, {
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

  /**
   * Обработка входящих обновлений от Telegram (webhook)
   */
  async handleUpdate(update: any): Promise<void> {
    try {
      // Обработка команд
      if (update.message?.text?.startsWith('/')) {
        await this.handleCommand(update.message);
      }
    } catch (error) {
      this.logger.error(`Error handling update: ${error.message}`);
    }
  }

  /**
   * Обработка команд бота
   */
  private async handleCommand(message: any): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text.trim();
    const command = text.split(' ')[0].toLowerCase();

    this.logger.log(`Received command: ${command} from chat ${chatId}`);

    if (command === '/id') {
      await this.handleIdCommand(chatId, message.chat);
    }
  }

  /**
   * Команда /id - отправляет chat ID группы/чата
   */
  private async handleIdCommand(chatId: number, chat: any): Promise<void> {
    const chatType = chat.type; // 'private', 'group', 'supergroup', 'channel'
    const chatTitle = chat.title || chat.first_name || 'Unknown';
    
    const message = `🆔 <b>Chat ID:</b> <code>${chatId}</code>\n<b>Тип:</b> ${chatType}\n<b>Название:</b> ${chatTitle}`;

    await this.sendMessage(String(chatId), message);
    this.logger.log(`Sent chat ID ${chatId} to ${chatType} "${chatTitle}"`);
  }

  /**
   * Установка webhook
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.botToken) {
      this.logger.error('Cannot set webhook: bot token not configured');
      return false;
    }

    try {
      const url = `${this.apiUrl}/bot${this.botToken}/setWebhook`;
      const response = await axios.post(url, {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      });

      if (response.data.ok) {
        this.logger.log(`✅ Webhook set to: ${webhookUrl}`);
        return true;
      } else {
        this.logger.error(`Failed to set webhook: ${response.data.description}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error setting webhook: ${error.message}`);
      return false;
    }
  }

  /**
   * Удаление webhook
   */
  async deleteWebhook(): Promise<boolean> {
    try {
      const url = `${this.apiUrl}/bot${this.botToken}/deleteWebhook`;
      const response = await axios.post(url);
      
      if (response.data.ok) {
        this.logger.log('✅ Webhook deleted');
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error deleting webhook: ${error.message}`);
      return false;
    }
  }

  /**
   * Получить информацию о webhook
   */
  async getWebhookInfo(): Promise<any> {
    try {
      const url = `${this.apiUrl}/bot${this.botToken}/getWebhookInfo`;
      const response = await axios.get(url);
      return response.data.result;
    } catch (error) {
      this.logger.error(`Error getting webhook info: ${error.message}`);
      throw error;
    }
  }
}

