import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  
  // Настройки из .env
  private readonly FIRST_REMINDER_HOURS = parseInt(process.env.FIRST_REMINDER_HOURS || '3', 10); // Первое напоминание через 3 часа
  private readonly REMINDER_INTERVAL_HOURS = parseInt(process.env.REMINDER_INTERVAL_HOURS || '3', 10); // Потом каждые 3 часа
  private readonly MODERN_REMINDER_DAYS = parseInt(process.env.MODERN_REMINDER_DAYS || '3', 10);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Каждый час проверяем заказы, которые нужно закрыть
   * Статусы: "Принял", "В пути", "В работе"
   * 
   * Логика напоминаний:
   * - Первое напоминание через 3 часа после dateMeeting (13:00 если встреча в 10:00)
   * - Потом каждые 3 часа: 16:00, 19:00, 22:00, и т.д.
   * - Пока мастер не закроет заказ
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkOrdersToClose() {
    this.logger.log('🔍 Checking orders that need to be closed...');

    try {
      const now = new Date();
      const firstReminderThreshold = new Date(now.getTime() - this.FIRST_REMINDER_HOURS * 60 * 60 * 1000);

      // Находим заказы с нужными статусами и прошедшей датой встречи
      const orders = await this.prisma.order.findMany({
        where: {
          statusOrder: {
            in: ['Принял', 'В пути', 'В работе'],
          },
          dateMeeting: {
            lte: firstReminderThreshold, // Дата встречи была 3+ часов назад
          },
          masterId: {
            not: null,
          },
        },
        include: {
          master: true,
        },
      });

      this.logger.log(`Found ${orders.length} orders to check for close reminders`);

      for (const order of orders) {
        if (!order.master || !order.master.chatId) {
          continue;
        }

        // Считаем сколько часов прошло с даты встречи
        const hoursSinceMeeting = Math.floor(
          (now.getTime() - order.dateMeeting.getTime()) / (1000 * 60 * 60)
        );

        // Отправляем напоминание если прошло 3+ часа (крон работает каждый час)
        if (hoursSinceMeeting >= this.FIRST_REMINDER_HOURS) {
          // Отправляем напоминание
          await this.notificationsService.sendCloseOrderReminderNotification({
            orderId: order.id,
            masterId: order.masterId!,
            clientName: order.clientName,
            daysOverdue: Math.floor(hoursSinceMeeting / 24),
          });

          this.logger.log(`✅ Sent close reminder for order ${order.id} to master ${order.master.name} (${hoursSinceMeeting}h overdue)`);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking orders to close: ${error.message}`);
    }
  }

  /**
   * Раз в день в 10:00 проверяем заказы в модерне
   * 
   * Логика:
   * ВАРИАНТ А (нет dateClosmod):
   *   - Первое напоминание через 3 дня после статуса "Модерн"
   *   - Потом каждый день в 10:00
   * 
   * ВАРИАНТ Б (есть dateClosmod):
   *   - В день dateClosmod напоминание
   *   - Если прошла дата и не закрыт → каждый день напоминание о просрочке
   */
  @Cron('0 10 * * *') // Каждый день в 10:00
  async checkModernOrders() {
    this.logger.log('🔍 Checking orders in modern status...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Находим заказы в статусе "Модерн"
      const orders = await this.prisma.order.findMany({
        where: {
          statusOrder: 'Модерн',
          masterId: {
            not: null,
          },
        },
        include: {
          master: true,
        },
      });

      this.logger.log(`Found ${orders.length} orders in modern status`);

      for (const order of orders) {
        if (!order.master || !order.master.chatId) {
          continue;
        }

        let shouldSendReminder = false;
        let daysUntilClosing = 0;
        let isOverdue = false;

        // Случай 1: Есть дата закрытия модерна
        if (order.dateClosmod) {
          const closingDate = new Date(order.dateClosmod);
          closingDate.setHours(0, 0, 0, 0);

          // В день закрытия или если уже просрочено
          if (closingDate <= today) {
            shouldSendReminder = true;
            
            if (closingDate.getTime() === today.getTime()) {
              daysUntilClosing = 0;
              this.logger.debug(`Order ${order.id}: Closing date is today`);
            } else {
              daysUntilClosing = Math.floor(
                (today.getTime() - closingDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              isOverdue = true;
              this.logger.debug(`Order ${order.id}: Overdue by ${daysUntilClosing} days`);
            }
          }
        } else {
          // Случай 2: Нет даты закрытия - напоминаем через 3+ дня после обновления
          const orderDate = new Date(order.updatedAt);
          orderDate.setHours(0, 0, 0, 0);
          
          const daysSinceOrderUpdate = Math.floor(
            (today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceOrderUpdate >= this.MODERN_REMINDER_DAYS) {
            shouldSendReminder = true;
            daysUntilClosing = 0;
            this.logger.debug(`Order ${order.id}: Daily reminder (${daysSinceOrderUpdate} days since update)`);
          }
        }

        if (shouldSendReminder) {
          // Отправляем напоминание
          await this.notificationsService.sendModernClosingReminderNotification({
            orderId: order.id,
            masterId: order.masterId!,
            clientName: order.clientName,
            expectedClosingDate: order.dateClosmod 
              ? new Date(order.dateClosmod).toLocaleDateString('ru-RU')
              : 'Не указано',
            daysUntilClosing: isOverdue ? -daysUntilClosing : daysUntilClosing,
          });

          this.logger.log(
            `✅ Sent modern reminder for order ${order.id} to master ${order.master.name}` +
            (isOverdue ? ` (overdue by ${daysUntilClosing} days)` : '')
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error checking modern orders: ${error.message}`);
    }
  }

  /**
   * Тестовый метод для ручной проверки (можно вызвать через API)
   */
  async testReminders() {
    this.logger.log('🧪 Testing reminder jobs manually...');
    await this.checkOrdersToClose();
    await this.checkModernOrders();
    return { success: true, message: 'Reminder jobs executed' };
  }
}

