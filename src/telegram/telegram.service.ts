import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { SiteOrdersParserService, ParsedSiteOrder } from './site-orders-parser.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiUrl: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // Начальная задержка в мс
  private readonly siteOrdersChatId: string;
  private readonly ordersServiceUrl: string;
  private readonly parser: SiteOrdersParserService;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.apiUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
    this.siteOrdersChatId = process.env.SITE_ORDERS_CHAT_ID || '';
    this.ordersServiceUrl = process.env.ORDERS_SERVICE_URL || 'http://orders-service:5003';
    this.parser = new SiteOrdersParserService();
    
    if (!this.botToken) {
      this.logger.warn('⚠️ TELEGRAM_BOT_TOKEN not configured');
    } else {
      this.logger.log('✅ Telegram Bot configured');
    }

    if (!this.siteOrdersChatId) {
      this.logger.warn('⚠️ SITE_ORDERS_CHAT_ID not configured - site orders parsing disabled');
    } else {
      this.logger.log(`✅ Site orders chat configured: ${this.siteOrdersChatId}`);
    }
  }

  /**
   * Задержка между повторными попытками (экспоненциальная)
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Проверка, является ли ошибка временной и можно ли повторять запрос
   */
  private isRetryableError(error: any): boolean {
    if (!error || !error.code) return false;
    
    // DNS ошибки (getaddrinfo EAI_AGAIN, ENOTFOUND)
    if (error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Сетевые ошибки
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // HTTP статусы для повторения
    if (error.response) {
      const status = error.response.status;
      return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    }
    
    return false;
  }

  async sendMessage(chatId: string, text: string, buttons?: Array<{text: string, url: string}>): Promise<boolean> {
    if (!this.botToken) {
      this.logger.error('Telegram bot token not configured');
      return false;
    }

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

    // Повторные попытки с экспоненциальной задержкой
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(url, payload, {
          timeout: 15000, // Увеличиваем timeout до 15 секунд
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.data.ok) {
          if (attempt > 1) {
            this.logger.log(`✅ Message sent to chat ${chatId} after ${attempt} attempts`);
          } else {
            this.logger.log(`✅ Message sent to chat ${chatId}`);
          }
          return true;
        } else {
          this.logger.error(`❌ Failed to send message: ${response.data.description}`);
          return false;
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        const isLastAttempt = attempt === this.maxRetries;
        
        // Если это последняя попытка, логируем ошибку и возвращаем false
        if (isLastAttempt) {
          if (axiosError.code) {
            this.logger.error(`❌ Error sending Telegram message after ${this.maxRetries} attempts: ${axiosError.code} - ${axiosError.message}`);
          } else if (axiosError.response) {
            this.logger.error(`❌ Error sending Telegram message: HTTP ${axiosError.response.status} - ${axiosError.response.statusText}`);
          } else {
            this.logger.error(`❌ Error sending Telegram message: ${axiosError.message}`);
          }
          return false;
        }
        
        // Проверяем, можно ли повторять запрос
        if (this.isRetryableError(axiosError)) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Экспоненциальная задержка
          this.logger.warn(`⚠️ Telegram API error (attempt ${attempt}/${this.maxRetries}): ${axiosError.code || axiosError.message}. Retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          // Если ошибка не повторяемая, сразу возвращаем false
          this.logger.error(`❌ Non-retryable error sending Telegram message: ${axiosError.code || axiosError.message}`);
          return false;
        }
      }
    }

    return false;
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
      const message = update.message;
      if (!message?.text) return;

      const chatId = String(message.chat.id);

      // Обработка команд (из любого чата)
      if (message.text.startsWith('/')) {
        await this.handleCommand(message);
        return;
      }

      // Проверяем, это сообщение из чата заявок с сайтов
      if (this.siteOrdersChatId && chatId === this.siteOrdersChatId) {
        // Проверяем, это заявка с сайта
        if (this.parser.isSiteOrderMessage(message.text)) {
          await this.handleSiteOrder(message);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling update: ${error.message}`);
    }
  }

  /**
   * Обработка заявки с сайта
   */
  private async handleSiteOrder(message: any): Promise<void> {
    const parsed = this.parser.parse(message.text);

    if (!parsed) {
      this.logger.warn('Failed to parse site order message');
      return;
    }

    try {
      // Проверяем, нет ли уже такой заявки (дедупликация по телефону за последние 5 минут)
      const isDuplicate = await this.checkDuplicate(parsed.phone);
      if (isDuplicate) {
        this.logger.log(`⏭️ Duplicate site order skipped: ${parsed.phone}`);
        return;
      }

      // Отправляем в orders-service
      const response = await axios.post(
        `${this.ordersServiceUrl}/api/v1/site-orders`,
        parsed,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`✅ Site order created: ID ${response.data.id} - ${parsed.site} - ${parsed.clientName}`);
      
      // Можно отправить подтверждение в чат (опционально)
      // await this.sendMessage(String(message.chat.id), `✅ Заявка #${response.data.id} сохранена`);
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        this.logger.error(`❌ Failed to create site order: HTTP ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
      } else {
        this.logger.error(`❌ Failed to create site order: ${axiosError.message}`);
      }
    }
  }

  /**
   * Проверка на дубликат (один телефон за последние 5 минут)
   */
  private async checkDuplicate(phone: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.ordersServiceUrl}/api/v1/site-orders`,
        {
          params: {
            search: phone,
            limit: 1,
          },
          timeout: 5000,
        }
      );

      if (response.data?.data?.length > 0) {
        const lastOrder = response.data.data[0];
        const createdAt = new Date(lastOrder.createdAt);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        // Если заявка создана менее 5 минут назад — это дубликат
        return createdAt > fiveMinutesAgo;
      }

      return false;
    } catch (error) {
      // В случае ошибки — не блокируем создание
      this.logger.warn(`Failed to check duplicate: ${error.message}`);
      return false;
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

