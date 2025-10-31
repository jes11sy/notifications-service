import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  SendNotificationDto,
  NewOrderNotificationDto,
  DateChangeNotificationDto,
  OrderRejectionNotificationDto,
  MasterAssignedNotificationDto,
  OrderAcceptedNotificationDto,
  OrderClosedNotificationDto,
  OrderInModernNotificationDto,
  CloseOrderReminderNotificationDto,
  ModernClosingReminderNotificationDto,
} from './dto/notification.dto';
import { MESSAGE_TEMPLATES, MessageType } from './message-templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async sendNotification(dto: SendNotificationDto) {
    const { type, orderId, city, masterId, data } = dto;

    // Получаем шаблон из хардкода
    const template = MESSAGE_TEMPLATES[type as MessageType];

    if (!template) {
      return {
        success: false,
        message: `Template for type "${type}" not found`,
      };
    }

    const results = [];
    const messageData = { orderId, city, ...data };

    // Определяем тип получателя по типу уведомления
    if ((template.recipientType === 'director' || template.recipientType === 'both') && city) {
      // Отправка директорам
      const directors = await this.prisma.director.findMany({
        where: {
          cities: { has: city },
          tgId: { not: null },
        },
      });

      if (directors.length === 0) {
        this.logger.warn(`No directors found for city: ${city}`);
        return {
          success: false,
          message: `No directors configured for city: ${city}`,
        };
      }

      // Формируем сообщение
      const message = template.format(messageData);

      // Отправляем уведомления всем директорам
      for (const director of directors) {
        try {
          const sent = await this.telegram.sendMessage(director.tgId, message);
          
          // Сохраняем в историю
          await this.prisma.notification.create({
            data: {
              type,
              orderId,
              recipientType: 'director',
              directorId: director.id,
              message,
              status: sent ? 'sent' : 'failed',
              sentAt: sent ? new Date() : null,
              errorMessage: sent ? null : 'Failed to send',
            },
          });

          results.push({
            recipientType: 'director',
            directorId: director.id,
            directorName: director.name,
            success: sent,
          });
        } catch (error) {
          this.logger.error(`Error sending notification to director ${director.id}: ${error.message}`);
          results.push({
            recipientType: 'director',
            directorId: director.id,
            directorName: director.name,
            success: false,
            error: error.message,
          });
        }
      }
    } 
    
    if ((template.recipientType === 'master' || template.recipientType === 'both') && masterId) {
      // Отправка мастеру
      const master = await this.prisma.master.findUnique({
        where: { id: masterId },
      });

      if (!master) {
        this.logger.warn(`Master not found: ${masterId}`);
        return {
          success: false,
          message: `Master with ID ${masterId} not found`,
        };
      }

      if (!master.tgId) {
        this.logger.warn(`Master ${masterId} has no Telegram ID configured`);
        return {
          success: false,
          message: `Master ${master.name} has no Telegram configured`,
        };
      }

      // Формируем сообщение
      const message = template.format(messageData);

      try {
        const sent = await this.telegram.sendMessage(master.tgId, message);
        
        // Сохраняем в историю
        await this.prisma.notification.create({
          data: {
            type,
            orderId,
            recipientType: 'master',
            masterId: master.id,
            message,
            status: sent ? 'sent' : 'failed',
            sentAt: sent ? new Date() : null,
            errorMessage: sent ? null : 'Failed to send',
          },
        });

        results.push({
          recipientType: 'master',
          masterId: master.id,
          masterName: master.name,
          success: sent,
        });
      } catch (error) {
        this.logger.error(`Error sending notification to master ${master.id}: ${error.message}`);
        results.push({
          recipientType: 'master',
          masterId: master.id,
          masterName: master.name,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      success: results.length > 0,
      message: 'Notifications processed',
      data: results,
    };
  }

  async sendNewOrderNotification(dto: NewOrderNotificationDto) {
    return this.sendNotification({
      type: 'new_order',
      orderId: dto.orderId,
      city: dto.city,
      data: {
        clientName: dto.clientName,
        phone: dto.phone,
        address: dto.address,
        dateMeeting: new Date(dto.dateMeeting).toLocaleString('ru-RU'),
        problem: dto.problem,
        rk: dto.rk || 'Не указано',
        avitoName: dto.avitoName || 'Не указано',
        typeEquipment: dto.typeEquipment || 'БТ',
      },
    });
  }

  async sendDateChangeNotification(dto: DateChangeNotificationDto) {
    const results = [];

    // Отправляем уведомление директору
    const directorResult = await this.sendNotification({
      type: 'date_change',
      orderId: dto.orderId,
      city: dto.city,
      data: {
        clientName: dto.clientName,
        newDate: new Date(dto.newDate).toLocaleString('ru-RU'),
        oldDate: dto.oldDate ? new Date(dto.oldDate).toLocaleString('ru-RU') : 'Не указано',
      },
    });
    results.push({ recipient: 'director', ...directorResult });

    // Если мастер назначен, отправляем ему тоже
    if (dto.masterId) {
      const masterResult = await this.sendNotification({
        type: 'date_change',
        orderId: dto.orderId,
        masterId: dto.masterId,
        data: {
          clientName: dto.clientName,
          newDate: new Date(dto.newDate).toLocaleString('ru-RU'),
          oldDate: dto.oldDate ? new Date(dto.oldDate).toLocaleString('ru-RU') : 'Не указано',
        },
      });
      results.push({ recipient: 'master', ...masterResult });
    }

    return {
      success: results.every(r => r.success),
      message: 'Notifications sent',
      data: results,
    };
  }

  async sendOrderRejectionNotification(dto: OrderRejectionNotificationDto) {
    const results = [];

    // Отправляем уведомление директору
    const directorResult = await this.sendNotification({
      type: 'order_rejection',
      orderId: dto.orderId,
      city: dto.city,
      data: {
        clientName: dto.clientName,
        phone: dto.phone,
        reason: dto.reason,
      },
    });
    results.push({ recipient: 'director', ...directorResult });

    // Если мастер назначен, отправляем ему тоже
    if (dto.masterId) {
      const masterResult = await this.sendNotification({
        type: 'order_rejection',
        orderId: dto.orderId,
        masterId: dto.masterId,
        data: {
          clientName: dto.clientName,
          phone: dto.phone,
          reason: dto.reason,
        },
      });
      results.push({ recipient: 'master', ...masterResult });
    }

    return {
      success: results.every(r => r.success),
      message: 'Notifications sent',
      data: results,
    };
  }

  // Методы для уведомлений мастерам
  async sendMasterAssignedNotification(dto: MasterAssignedNotificationDto) {
    return this.sendNotification({
      type: 'master_assigned',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        rk: dto.rk || 'Не указано',
        avitoName: dto.avitoName || 'Не указано',
        typeEquipment: dto.typeEquipment || 'БТ',
        clientName: dto.clientName || 'Не указано',
        address: dto.address || 'Не указано',
        dateMeeting: dto.dateMeeting ? new Date(dto.dateMeeting).toLocaleString('ru-RU') : 'Не указано',
      },
    });
  }

  async sendOrderAcceptedNotification(dto: OrderAcceptedNotificationDto) {
    return this.sendNotification({
      type: 'order_accepted',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: dto.clientName || 'Не указано',
      },
    });
  }

  async sendOrderClosedNotification(dto: OrderClosedNotificationDto) {
    return this.sendNotification({
      type: 'order_closed',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: dto.clientName || 'Не указано',
        closingDate: dto.closingDate ? new Date(dto.closingDate).toLocaleString('ru-RU') : new Date().toLocaleString('ru-RU'),
      },
    });
  }

  async sendOrderInModernNotification(dto: OrderInModernNotificationDto) {
    return this.sendNotification({
      type: 'order_in_modern',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: dto.clientName || 'Не указано',
        expectedClosingDate: new Date(dto.expectedClosingDate).toLocaleString('ru-RU'),
      },
    });
  }

  async sendCloseOrderReminderNotification(dto: CloseOrderReminderNotificationDto) {
    return this.sendNotification({
      type: 'close_order_reminder',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: dto.clientName || 'Не указано',
        daysOverdue: dto.daysOverdue || 0,
      },
    });
  }

  async sendModernClosingReminderNotification(dto: ModernClosingReminderNotificationDto) {
    return this.sendNotification({
      type: 'modern_closing_reminder',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: dto.clientName || 'Не указано',
        expectedClosingDate: new Date(dto.expectedClosingDate).toLocaleString('ru-RU'),
        daysUntilClosing: dto.daysUntilClosing || 0,
      },
    });
  }

  async getHistory(query: any) {
    const { type, directorId, masterId, status, startDate, endDate, limit = 100, offset = 0 } = query;

    const where: any = {};

    if (type) where.type = type;
    if (directorId) where.directorId = +directorId;
    if (masterId) where.masterId = +masterId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          director: {
            select: {
              id: true,
              name: true,
            },
          },
          master: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: +limit,
        skip: +offset,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      success: true,
      data: notifications,
      pagination: {
        total,
        limit: +limit,
        offset: +offset,
      },
    };
  }

  async getStats(query: any) {
    const { startDate, endDate } = query;

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [total, sent, failed, byType] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, status: 'sent' } }),
      this.prisma.notification.count({ where: { ...where, status: 'failed' } }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        sent,
        failed,
        successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        }, {}),
      },
    };
  }
}

