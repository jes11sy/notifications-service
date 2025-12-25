import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  
  // Настройки из .env
  private readonly MODERN_REMINDER_DAYS = parseInt(process.env.MODERN_REMINDER_DAYS || '3', 10);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * ❌ ОТКЛЮЧЕНО: Напоминание о незакрытых заказах
   * Убрано по запросу - теперь только напоминания о модерне
   */
  // @Cron(CronExpression.EVERY_HOUR)
  // async checkOrdersToClose() {
  //   ...
  // }

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
            expectedClosingDate: order.dateClosmod ? order.dateClosmod.toISOString() : undefined,
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
    await this.checkModernOrders();
    return { success: true, message: 'Modern reminder job executed' };
  }
}

