import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { SendNotificationDto, NewOrderNotificationDto, DateChangeNotificationDto, OrderRejectionNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async sendNotification(dto: SendNotificationDto) {
    const { type, orderId, city, data } = dto;

    // Получаем шаблон сообщения
    const template = await this.prisma.messageTemplate.findUnique({
      where: { type },
    });

    if (!template || !template.enabled) {
      return {
        success: false,
        message: `Template for type "${type}" not found or disabled`,
      };
    }

    // Находим директоров для этого города
    const directors = await this.prisma.director.findMany({
      where: {
        cities: { has: city },
        chatId: { not: null },
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
    const message = this.telegram.formatMessage(template.template, {
      orderId,
      city,
      ...data,
    });

    // Отправляем уведомления всем директорам
    const results = [];
    for (const director of directors) {
      try {
        const sent = await this.telegram.sendMessage(director.chatId, message);
        
        // Сохраняем в историю
        await this.prisma.notification.create({
          data: {
            type,
            orderId,
            directorId: director.id,
            message,
            status: sent ? 'sent' : 'failed',
            sentAt: sent ? new Date() : null,
            errorMessage: sent ? null : 'Failed to send',
          },
        });

        results.push({
          directorId: director.id,
          directorName: director.name,
          success: sent,
        });
      } catch (error) {
        this.logger.error(`Error sending notification to director ${director.id}: ${error.message}`);
        results.push({
          directorId: director.id,
          directorName: director.name,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      message: 'Notifications processed',
      data: results,
    };
  }

  async sendNewOrderNotification(dto: NewOrderNotificationDto) {
    return this.sendNotification({
      type: 'new_order',
      orderId: dto.orderId,
      city: dto.city,
      token: dto.token,
      data: {
        clientName: dto.clientName,
        phone: dto.phone,
        address: dto.address,
        dateMeeting: new Date(dto.dateMeeting).toLocaleString('ru-RU'),
        problem: dto.problem,
        rk: dto.rk || 'Не указано',
      },
    });
  }

  async sendDateChangeNotification(dto: DateChangeNotificationDto) {
    return this.sendNotification({
      type: 'date_change',
      orderId: dto.orderId,
      city: dto.city,
      token: dto.token,
      data: {
        clientName: dto.clientName,
        newDate: new Date(dto.newDate).toLocaleString('ru-RU'),
        oldDate: dto.oldDate ? new Date(dto.oldDate).toLocaleString('ru-RU') : 'Не указано',
      },
    });
  }

  async sendOrderRejectionNotification(dto: OrderRejectionNotificationDto) {
    return this.sendNotification({
      type: 'order_rejection',
      orderId: dto.orderId,
      city: dto.city,
      token: dto.token,
      data: {
        clientName: dto.clientName,
        phone: dto.phone,
        reason: dto.reason,
      },
    });
  }

  async getHistory(query: any) {
    const { type, directorId, status, startDate, endDate, limit = 100, offset = 0 } = query;

    const where: any = {};

    if (type) where.type = type;
    if (directorId) where.directorId = +directorId;
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

