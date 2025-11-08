import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  SendNotificationDto,
  NewOrderNotificationDto,
  DateChangeNotificationDto,
  OrderRejectionNotificationDto,
  MasterAssignedNotificationDto,
  MasterReassignedNotificationDto,
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

      // Добавляем кнопку со ссылкой на заказ для директоров
      const directorButtons: Array<{text: string, url: string}> = [{
        text: '📋 Открыть заказ',
        url: `https://new.lead-schem.ru/orders/${orderId}`
      }];

      // Отправляем уведомления всем директорам
      for (const director of directors) {
      try {
        const sent = await this.telegram.sendMessage(director.tgId, message, directorButtons);

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

      if (!master.chatId) {
        this.logger.warn(`Master ${masterId} has no Telegram chat ID configured`);
        return {
          success: false,
          message: `Master ${master.name} has no Telegram configured`,
        };
      }

      // Формируем сообщение
      const message = template.format(messageData);

      // Добавляем кнопку со ссылкой на заказ для определенных типов уведомлений
      let buttons: Array<{text: string, url: string}> | undefined;
      if (['master_assigned', 'close_order_reminder', 'modern_closing_reminder'].includes(type as string)) {
        buttons = [{
          text: '📋 Открыть заказ',
          url: `https://lead-schem.ru/orders/${orderId}`
        }];
      }

      try {
        const sent = await this.telegram.sendMessage(master.chatId, message, buttons);

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
        dateMeeting: new Date(dto.dateMeeting).toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        problem: dto.problem,
        rk: dto.rk || 'Не указано',
        avitoName: dto.avitoName || 'Не указано',
        typeEquipment: dto.typeEquipment || 'БТ',
      },
    });
  }

  async sendDateChangeNotification(dto: DateChangeNotificationDto) {
    const results = [];

    const dateFormat = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    } as const;

    // Загружаем данные заказа из БД
    let orderData = {
      rk: undefined as string | undefined,
      avitoName: undefined as string | undefined,
      typeEquipment: undefined as string | undefined,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: {
          rk: true,
          avitoName: true,
          typeEquipment: true,
        },
      });

      if (order) {
        orderData = {
          rk: order.rk,
          avitoName: order.avitoName,
          typeEquipment: order.typeEquipment,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
    }

    // Отправляем уведомление директору
    const directorResult = await this.sendNotification({
      type: 'date_change',
      orderId: dto.orderId,
      city: dto.city,
      data: {
        clientName: dto.clientName,
        rk: orderData.rk,
        avitoName: orderData.avitoName,
        typeEquipment: orderData.typeEquipment,
        newDate: new Date(dto.newDate).toLocaleString('ru-RU', dateFormat),
        oldDate: dto.oldDate ? new Date(dto.oldDate).toLocaleString('ru-RU', dateFormat) : 'Не указано',
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
          rk: orderData.rk,
          avitoName: orderData.avitoName,
          typeEquipment: orderData.typeEquipment,
          newDate: new Date(dto.newDate).toLocaleString('ru-RU', dateFormat),
          oldDate: dto.oldDate ? new Date(dto.oldDate).toLocaleString('ru-RU', dateFormat) : 'Не указано',
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

    // Запрашиваем данные из БД, если не все поля переданы
    let orderData = {
      clientName: dto.clientName,
      phone: dto.phone,
      city: dto.city,
      rk: dto.rk,
      avitoName: dto.avitoName,
      typeEquipment: dto.typeEquipment,
      dateMeeting: dto.dateMeeting,
      reason: dto.reason,
    };

    if (!dto.clientName || !dto.rk || !dto.typeEquipment || !dto.dateMeeting) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: dto.orderId },
          select: {
            clientName: true,
            phone: true,
            city: true,
            rk: true,
            avitoName: true,
            typeEquipment: true,
            dateMeeting: true,
          },
        });

        if (order) {
          orderData = {
            clientName: dto.clientName || order.clientName,
            phone: dto.phone || order.phone,
            city: dto.city || order.city,
            rk: dto.rk || order.rk,
            avitoName: dto.avitoName || order.avitoName,
            typeEquipment: dto.typeEquipment || order.typeEquipment,
            dateMeeting: dto.dateMeeting || order.dateMeeting?.toISOString(),
            reason: dto.reason,
          };
        }
      } catch (error) {
        this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
      }
    }

    // Отправляем уведомление директору
    const directorResult = await this.sendNotification({
      type: 'order_rejection',
      orderId: dto.orderId,
      city: orderData.city,
      data: {
        clientName: orderData.clientName,
        phone: orderData.phone,
        reason: orderData.reason,
        rk: orderData.rk,
        avitoName: orderData.avitoName,
        typeEquipment: orderData.typeEquipment,
        dateMeeting: orderData.dateMeeting,
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
          clientName: orderData.clientName,
          phone: orderData.phone,
          reason: orderData.reason,
          rk: orderData.rk,
          avitoName: orderData.avitoName,
          typeEquipment: orderData.typeEquipment,
          dateMeeting: orderData.dateMeeting,
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
        dateMeeting: dto.dateMeeting ? new Date(dto.dateMeeting).toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : 'Не указано',
      },
    });
  }

  async sendMasterReassignedNotification(dto: MasterReassignedNotificationDto) {
    return this.sendNotification({
      type: 'master_reassigned',
      orderId: dto.orderId,
      masterId: dto.oldMasterId, // Отправляем старому мастеру
      data: {},
    });
  }

  async sendOrderAcceptedNotification(dto: OrderAcceptedNotificationDto) {
    // ВСЕГДА загружаем данные из БД, так как phone и address обычно не передаются в DTO
    let orderData = {
      clientName: dto.clientName,
      phone: undefined as string | undefined,
      address: undefined as string | undefined,
      rk: dto.rk,
      avitoName: dto.avitoName,
      typeEquipment: dto.typeEquipment,
      dateMeeting: dto.dateMeeting,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: {
          clientName: true,
          phone: true,
          address: true,
          rk: true,
          avitoName: true,
          typeEquipment: true,
          dateMeeting: true,
        },
      });

      if (order) {
        orderData = {
          clientName: dto.clientName || order.clientName,
          phone: order.phone,
          address: order.address,
          rk: dto.rk || order.rk,
          avitoName: dto.avitoName || order.avitoName,
          typeEquipment: dto.typeEquipment || order.typeEquipment,
          dateMeeting: dto.dateMeeting || order.dateMeeting?.toISOString(),
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
    }

    return this.sendNotification({
      type: 'order_accepted',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: orderData.clientName || 'Не указано',
        phone: orderData.phone || undefined,
        address: orderData.address || undefined,
        rk: orderData.rk || undefined,
        avitoName: orderData.avitoName || undefined,
        typeEquipment: orderData.typeEquipment || undefined,
        dateMeeting: orderData.dateMeeting ? new Date(orderData.dateMeeting).toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : undefined,
      },
    });
  }

  async sendOrderClosedNotification(dto: OrderClosedNotificationDto) {
    // Если данные не переданы, запрашиваем из БД
    let orderData = {
      clientName: dto.clientName,
      closingDate: dto.closingDate,
      total: dto.total,
      expense: dto.expense,
      net: dto.net,
      handover: dto.handover,
    };

    // Если хотя бы одно поле не указано - запрашиваем заказ из БД
    if (!dto.clientName || !dto.total || !dto.expense || !dto.net || !dto.handover) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: dto.orderId },
          select: {
            clientName: true,
            result: true,
            expenditure: true,
            clean: true,
            masterChange: true,
            closingData: true,
          },
        });

        if (order) {
          orderData = {
            clientName: dto.clientName || order.clientName,
            closingDate: dto.closingDate || order.closingData?.toISOString(),
            total: dto.total || order.result?.toString(),
            expense: dto.expense || order.expenditure?.toString(),
            net: dto.net || order.clean?.toString(),
            handover: dto.handover || order.masterChange?.toString(),
          };
        }
      } catch (error) {
        this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
      }
    }

    const dateFormat = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    } as const;

    return this.sendNotification({
      type: 'order_closed',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: orderData.clientName || 'Не указано',
        closingDate: orderData.closingDate ? new Date(orderData.closingDate).toLocaleString('ru-RU', dateFormat) : new Date().toLocaleString('ru-RU', dateFormat),
        total: orderData.total || undefined,
        expense: orderData.expense || undefined,
        net: orderData.net || undefined,
        handover: orderData.handover || undefined,
      },
    });
  }

  async sendOrderInModernNotification(dto: OrderInModernNotificationDto) {
    // Если данные не переданы, запрашиваем из БД
    let orderData = {
      clientName: dto.clientName,
      rk: dto.rk,
      avitoName: dto.avitoName,
      typeEquipment: dto.typeEquipment,
      dateMeeting: dto.dateMeeting,
      prepayment: dto.prepayment,
      expectedClosingDate: dto.expectedClosingDate,
      comment: dto.comment,
    };

    if (!dto.clientName || !dto.rk || !dto.typeEquipment || !dto.dateMeeting) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: dto.orderId },
          select: {
            clientName: true,
            rk: true,
            avitoName: true,
            typeEquipment: true,
            dateMeeting: true,
            dateClosmod: true,
          },
        });

        if (order) {
          orderData = {
            clientName: dto.clientName || order.clientName,
            rk: dto.rk || order.rk,
            avitoName: dto.avitoName || order.avitoName,
            typeEquipment: dto.typeEquipment || order.typeEquipment,
            dateMeeting: dto.dateMeeting || order.dateMeeting?.toISOString(),
            prepayment: dto.prepayment,
            expectedClosingDate: dto.expectedClosingDate || order.dateClosmod?.toISOString(),
            comment: dto.comment,
          };
        }
      } catch (error) {
        this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
      }
    }

    const dateTimeFormat = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    } as const;

    const dateFormat = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    } as const;

    return this.sendNotification({
      type: 'order_in_modern',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: orderData.clientName || 'Не указано',
        rk: orderData.rk || undefined,
        avitoName: orderData.avitoName || undefined,
        typeEquipment: orderData.typeEquipment || undefined,
        dateMeeting: orderData.dateMeeting ? new Date(orderData.dateMeeting).toLocaleString('ru-RU', dateTimeFormat) : undefined,
        prepayment: orderData.prepayment || undefined,
        expectedClosingDate: orderData.expectedClosingDate ? new Date(orderData.expectedClosingDate).toLocaleDateString('ru-RU', dateFormat) : undefined,
        comment: orderData.comment || undefined,
      },
    });
  }

  async sendCloseOrderReminderNotification(dto: CloseOrderReminderNotificationDto) {
    // Запрашиваем данные заказа из БД для полноты информации
    let orderData = {
      clientName: dto.clientName,
      rk: undefined as string | undefined,
      avitoName: undefined as string | undefined,
      typeEquipment: undefined as string | undefined,
      dateMeeting: undefined as string | undefined,
      daysOverdue: dto.daysOverdue || 0,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: {
          clientName: true,
          rk: true,
          avitoName: true,
          typeEquipment: true,
          dateMeeting: true,
        },
      });

      if (order) {
        orderData = {
          clientName: dto.clientName || order.clientName,
          rk: order.rk,
          avitoName: order.avitoName,
          typeEquipment: order.typeEquipment,
          dateMeeting: order.dateMeeting?.toISOString(),
          daysOverdue: dto.daysOverdue || 0,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
    }

    return this.sendNotification({
      type: 'close_order_reminder',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: orderData.clientName || 'Не указано',
        rk: orderData.rk || undefined,
        avitoName: orderData.avitoName || undefined,
        typeEquipment: orderData.typeEquipment || undefined,
        dateMeeting: orderData.dateMeeting ? new Date(orderData.dateMeeting).toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : undefined,
        daysOverdue: orderData.daysOverdue,
      },
    });
  }

  async sendModernClosingReminderNotification(dto: ModernClosingReminderNotificationDto) {
    // Запрашиваем данные заказа из БД для полноты информации
    let orderData = {
      clientName: dto.clientName,
      rk: undefined as string | undefined,
      avitoName: undefined as string | undefined,
      typeEquipment: undefined as string | undefined,
      dateMeeting: undefined as string | undefined,
      expectedClosingDate: dto.expectedClosingDate,
      daysUntilClosing: dto.daysUntilClosing || 0,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: {
          clientName: true,
          rk: true,
          avitoName: true,
          typeEquipment: true,
          dateMeeting: true,
          dateClosmod: true,
        },
      });

      if (order) {
        orderData = {
          clientName: dto.clientName || order.clientName,
          rk: order.rk,
          avitoName: order.avitoName,
          typeEquipment: order.typeEquipment,
          dateMeeting: order.dateMeeting?.toISOString(),
          expectedClosingDate: dto.expectedClosingDate || order.dateClosmod?.toISOString(),
          daysUntilClosing: dto.daysUntilClosing || 0,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
    }

    const dateTimeFormat = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    } as const;

    const dateFormat = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    } as const;

    return this.sendNotification({
      type: 'modern_closing_reminder',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: orderData.clientName || 'Не указано',
        rk: orderData.rk || undefined,
        avitoName: orderData.avitoName || undefined,
        typeEquipment: orderData.typeEquipment || undefined,
        dateMeeting: orderData.dateMeeting ? new Date(orderData.dateMeeting).toLocaleString('ru-RU', dateTimeFormat) : undefined,
        expectedClosingDate: orderData.expectedClosingDate ? new Date(orderData.expectedClosingDate).toLocaleDateString('ru-RU', dateFormat) : undefined,
        daysUntilClosing: orderData.daysUntilClosing,
      },
    });
  }
}

