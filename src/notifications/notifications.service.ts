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
  CityChangeNotificationDto,
  AddressChangeNotificationDto,
} from './dto/notification.dto';
import { MESSAGE_TEMPLATES, MessageType } from './message-templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private formatDate(dateString: string | undefined, format: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }): string {
    if (!dateString) return 'Не указано';

    if (typeof dateString === 'string' && /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(dateString)) {
      return dateString;
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      this.logger.warn(`Invalid date format: ${dateString}`);
      return 'Не указано';
    }
    return date.toLocaleString('ru-RU', format);
  }

  private formatDateOnly(dateString: string | undefined): string {
    return this.formatDate(dateString, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  /**
   * Find city ID by city name for director lookup
   */
  private async getCityIdByName(cityName: string): Promise<number | null> {
    try {
      const city = await this.prisma.city.findFirst({ where: { name: cityName } });
      return city?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Find directors for a city name
   */
  private async findDirectorsByCity(cityName: string) {
    const cityId = await this.getCityIdByName(cityName);
    if (!cityId) {
      this.logger.warn(`City not found: ${cityName}`);
      return [];
    }
    return this.prisma.director.findMany({
      where: {
        cityIds: { has: cityId },
        tgId: { not: null },
      },
    });
  }

  async sendNotification(dto: SendNotificationDto) {
    const { type, orderId, city, masterId, data } = dto;

    const template = MESSAGE_TEMPLATES[type as MessageType];

    if (!template) {
      return {
        success: false,
        message: `Template for type "${type}" not found`,
      };
    }

    const results = [];
    const messageData = { orderId, city, ...data };

    if ((template.recipientType === 'director' || template.recipientType === 'both') && city) {
      const directors = await this.findDirectorsByCity(city);

      if (directors.length === 0) {
        this.logger.warn(`No directors found for city: ${city}`);
        return {
          success: false,
          message: `No directors configured for city: ${city}`,
        };
      }

      const message = template.format(messageData);

      const directorButtons: Array<{text: string, url: string}> = [{
        text: '📋 Открыть заказ',
        url: `https://new.lead-schem.ru/orders/${orderId}`
      }];

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

      const message = template.format(messageData);

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
        dateMeeting: this.formatDate(dto.dateMeeting),
        problem: dto.problem,
        rk: dto.rk || 'Не указано',
        typeEquipment: dto.typeEquipment || 'БТ',
      },
    });
  }

  async sendDateChangeNotification(dto: DateChangeNotificationDto) {
    const results = [];

    let orderData = {
      rk: undefined as string | undefined,
      typeEquipment: undefined as string | undefined,
      address: undefined as string | undefined,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          rk: { select: { name: true } },
          equipmentType: { select: { name: true } },
        },
      });

      if (order) {
        orderData = {
          rk: order.rk.name,
          typeEquipment: order.equipmentType.name,
          address: order.address,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
    }

    const directorResult = await this.sendNotification({
      type: 'date_change',
      orderId: dto.orderId,
      city: dto.city,
      data: {
        clientName: dto.clientName,
        rk: orderData.rk,
        typeEquipment: orderData.typeEquipment,
        address: dto.address || orderData.address,
        newDate: this.formatDate(dto.newDate),
        oldDate: dto.oldDate ? this.formatDate(dto.oldDate) : 'Не указано',
      },
    });
    results.push({ recipient: 'director', ...directorResult });

    if (dto.masterId) {
      const masterResult = await this.sendNotification({
        type: 'date_change',
        orderId: dto.orderId,
        masterId: dto.masterId,
        data: {
          clientName: dto.clientName,
          rk: orderData.rk,
          typeEquipment: orderData.typeEquipment,
          address: dto.address || orderData.address,
          newDate: this.formatDate(dto.newDate),
          oldDate: dto.oldDate ? this.formatDate(dto.oldDate) : 'Не указано',
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

    let orderData = {
      clientName: dto.clientName,
      phone: dto.phone,
      city: dto.city,
      rk: dto.rk,
      typeEquipment: dto.typeEquipment,
      dateMeeting: dto.dateMeeting,
      reason: dto.reason,
    };

    if (!dto.clientName || !dto.rk || !dto.typeEquipment || !dto.dateMeeting) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: dto.orderId },
          include: {
            city: { select: { name: true } },
            rk: { select: { name: true } },
            equipmentType: { select: { name: true } },
          },
        });

        if (order) {
          orderData = {
            clientName: dto.clientName || order.clientName,
            phone: dto.phone || order.phone,
            city: dto.city || order.city.name,
            rk: dto.rk || order.rk.name,
            typeEquipment: dto.typeEquipment || order.equipmentType.name,
            dateMeeting: dto.dateMeeting || order.dateMeeting?.toISOString(),
            reason: dto.reason,
          };
        }
      } catch (error) {
        this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
      }
    }

    const directorResult = await this.sendNotification({
      type: 'order_rejection',
      orderId: dto.orderId,
      city: orderData.city,
      data: {
        clientName: orderData.clientName,
        phone: orderData.phone,
        reason: orderData.reason,
        rk: orderData.rk,
        typeEquipment: orderData.typeEquipment,
        dateMeeting: orderData.dateMeeting,
      },
    });
    results.push({ recipient: 'director', ...directorResult });

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

  async sendMasterAssignedNotification(dto: MasterAssignedNotificationDto) {
    return this.sendNotification({
      type: 'master_assigned',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        rk: dto.rk || 'Не указано',
        typeEquipment: dto.typeEquipment || 'БТ',
        clientName: dto.clientName || 'Не указано',
        address: dto.address || 'Не указано',
        dateMeeting: this.formatDate(dto.dateMeeting),
      },
    });
  }

  async sendMasterReassignedNotification(dto: MasterReassignedNotificationDto) {
    return this.sendNotification({
      type: 'master_reassigned',
      orderId: dto.orderId,
      masterId: dto.oldMasterId,
      data: {},
    });
  }

  async sendOrderAcceptedNotification(dto: OrderAcceptedNotificationDto) {
    let orderData = {
      clientName: dto.clientName,
      phone: undefined as string | undefined,
      address: undefined as string | undefined,
      rk: dto.rk,
      typeEquipment: dto.typeEquipment,
      dateMeeting: dto.dateMeeting,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          rk: { select: { name: true } },
          equipmentType: { select: { name: true } },
        },
      });

      if (order) {
        orderData = {
          clientName: dto.clientName || order.clientName,
          phone: order.phone,
          address: order.address,
          rk: dto.rk || order.rk.name,
          typeEquipment: dto.typeEquipment || order.equipmentType.name,
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
        typeEquipment: orderData.typeEquipment || undefined,
        dateMeeting: orderData.dateMeeting ? this.formatDate(orderData.dateMeeting) : undefined,
      },
    });
  }

  async sendOrderClosedNotification(dto: OrderClosedNotificationDto) {
    let orderData = {
      clientName: dto.clientName,
      closingDate: dto.closingDate,
      total: dto.total,
      expense: dto.expense,
      net: dto.net,
      handover: dto.handover,
    };

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
            closingAt: true,
          },
        });

        if (order) {
          orderData = {
            clientName: dto.clientName || order.clientName,
            closingDate: dto.closingDate || order.closingAt?.toISOString(),
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

    return this.sendNotification({
      type: 'order_closed',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: orderData.clientName || 'Не указано',
        closingDate: orderData.closingDate ? this.formatDate(orderData.closingDate) : this.formatDate(new Date().toISOString()),
        total: orderData.total || undefined,
        expense: orderData.expense || undefined,
        net: orderData.net || undefined,
        handover: orderData.handover || undefined,
      },
    });
  }

  async sendOrderInModernNotification(dto: OrderInModernNotificationDto) {
    let orderData = {
      clientName: dto.clientName,
      rk: dto.rk,
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
          include: {
            rk: { select: { name: true } },
            equipmentType: { select: { name: true } },
          },
        });

        if (order) {
          orderData = {
            clientName: dto.clientName || order.clientName,
            rk: dto.rk || order.rk.name,
            typeEquipment: dto.typeEquipment || order.equipmentType.name,
            dateMeeting: dto.dateMeeting || order.dateMeeting?.toISOString(),
            prepayment: dto.prepayment,
            expectedClosingDate: dto.expectedClosingDate || order.dateCloseMod?.toISOString(),
            comment: dto.comment,
          };
        }
      } catch (error) {
        this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
      }
    }

    return this.sendNotification({
      type: 'order_in_modern',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: orderData.clientName || 'Не указано',
        rk: orderData.rk || undefined,
        typeEquipment: orderData.typeEquipment || undefined,
        dateMeeting: orderData.dateMeeting || undefined,
        prepayment: orderData.prepayment || undefined,
        expectedClosingDate: orderData.expectedClosingDate || undefined,
        comment: orderData.comment || undefined,
      },
    });
  }

  async sendCloseOrderReminderNotification(dto: CloseOrderReminderNotificationDto) {
    let orderData = {
      clientName: dto.clientName,
      rk: undefined as string | undefined,
      typeEquipment: undefined as string | undefined,
      dateMeeting: undefined as string | undefined,
      daysOverdue: dto.daysOverdue || 0,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          rk: { select: { name: true } },
          equipmentType: { select: { name: true } },
        },
      });

      if (order) {
        orderData = {
          clientName: dto.clientName || order.clientName,
          rk: order.rk.name,
          typeEquipment: order.equipmentType.name,
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
        typeEquipment: orderData.typeEquipment || undefined,
        dateMeeting: orderData.dateMeeting || undefined,
        daysOverdue: orderData.daysOverdue,
      },
    });
  }

  async sendModernClosingReminderNotification(dto: ModernClosingReminderNotificationDto) {
    let orderData = {
      clientName: dto.clientName,
      rk: undefined as string | undefined,
      typeEquipment: undefined as string | undefined,
      dateMeeting: undefined as string | undefined,
      expectedClosingDate: dto.expectedClosingDate,
      daysUntilClosing: dto.daysUntilClosing || 0,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          rk: { select: { name: true } },
          equipmentType: { select: { name: true } },
        },
      });

      if (order) {
        orderData = {
          clientName: dto.clientName || order.clientName,
          rk: order.rk.name,
          typeEquipment: order.equipmentType.name,
          dateMeeting: order.dateMeeting?.toISOString(),
          expectedClosingDate: dto.expectedClosingDate || order.dateCloseMod?.toISOString(),
          daysUntilClosing: dto.daysUntilClosing || 0,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
    }

    return this.sendNotification({
      type: 'modern_closing_reminder',
      orderId: dto.orderId,
      masterId: dto.masterId,
      data: {
        clientName: orderData.clientName || 'Не указано',
        rk: orderData.rk || undefined,
        typeEquipment: orderData.typeEquipment || undefined,
        dateMeeting: orderData.dateMeeting || undefined,
        expectedClosingDate: orderData.expectedClosingDate || undefined,
        daysUntilClosing: orderData.daysUntilClosing,
      },
    });
  }

  async sendCityChangeNotification(dto: CityChangeNotificationDto) {
    const results = [];

    let orderData = {
      clientName: dto.clientName,
      rk: dto.rk,
      typeEquipment: dto.typeEquipment,
      dateMeeting: dto.dateMeeting,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          rk: { select: { name: true } },
          equipmentType: { select: { name: true } },
        },
      });

      if (order) {
        orderData = {
          clientName: dto.clientName || order.clientName,
          rk: dto.rk || order.rk.name,
          typeEquipment: dto.typeEquipment || order.equipmentType.name,
          dateMeeting: dto.dateMeeting || order.dateMeeting?.toISOString(),
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
    }

    const hadMaster = !!dto.masterId;

    const oldCityDirectors = await this.findDirectorsByCity(dto.oldCity);

    for (const director of oldCityDirectors) {
      try {
        const template = MESSAGE_TEMPLATES['city_change_old_city' as MessageType];
        const message = template.format({
          orderId: dto.orderId,
          oldCity: dto.oldCity,
          newCity: dto.newCity,
          clientName: orderData.clientName,
          rk: orderData.rk,
          typeEquipment: orderData.typeEquipment,
          dateMeeting: orderData.dateMeeting,
          hadMaster,
        });

        const sent = await this.telegram.sendMessage(director.tgId, message, [{
          text: '📋 Открыть заказ',
          url: `https://new.lead-schem.ru/orders/${dto.orderId}`
        }]);

        results.push({
          recipient: 'director_old_city',
          directorId: director.id,
          success: sent,
        });
      } catch (error) {
        this.logger.error(`Error sending city change notification to old city director ${director.id}: ${error.message}`);
        results.push({
          recipient: 'director_old_city',
          directorId: director.id,
          success: false,
          error: error.message,
        });
      }
    }

    const newCityDirectors = await this.findDirectorsByCity(dto.newCity);

    for (const director of newCityDirectors) {
      try {
        const template = MESSAGE_TEMPLATES['city_change_new_city' as MessageType];
        const message = template.format({
          orderId: dto.orderId,
          oldCity: dto.oldCity,
          newCity: dto.newCity,
          clientName: orderData.clientName,
          rk: orderData.rk,
          typeEquipment: orderData.typeEquipment,
          dateMeeting: orderData.dateMeeting,
        });

        const sent = await this.telegram.sendMessage(director.tgId, message, [{
          text: '📋 Открыть заказ',
          url: `https://new.lead-schem.ru/orders/${dto.orderId}`
        }]);

        results.push({
          recipient: 'director_new_city',
          directorId: director.id,
          success: sent,
        });
      } catch (error) {
        this.logger.error(`Error sending city change notification to new city director ${director.id}: ${error.message}`);
        results.push({
          recipient: 'director_new_city',
          directorId: director.id,
          success: false,
          error: error.message,
        });
      }
    }

    if (dto.masterId) {
      const masterResult = await this.sendNotification({
        type: 'city_change',
        orderId: dto.orderId,
        masterId: dto.masterId,
        data: {
          oldCity: dto.oldCity,
          newCity: dto.newCity,
          clientName: orderData.clientName,
        },
      });
      results.push({ recipient: 'master', ...masterResult });
    }

    return {
      success: results.length > 0 && results.some(r => r.success),
      message: 'City change notifications processed',
      data: results,
    };
  }

  async sendAddressChangeNotification(dto: AddressChangeNotificationDto) {
    const results = [];

    let orderData = {
      clientName: dto.clientName,
      rk: dto.rk,
      typeEquipment: dto.typeEquipment,
      dateMeeting: dto.dateMeeting,
    };

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          rk: { select: { name: true } },
          equipmentType: { select: { name: true } },
        },
      });

      if (order) {
        orderData = {
          clientName: dto.clientName || order.clientName,
          rk: dto.rk || order.rk.name,
          typeEquipment: dto.typeEquipment || order.equipmentType.name,
          dateMeeting: dto.dateMeeting || order.dateMeeting?.toISOString(),
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch order data for order #${dto.orderId}: ${error.message}`);
    }

    const directorResult = await this.sendNotification({
      type: 'address_change',
      orderId: dto.orderId,
      city: dto.city,
      data: {
        oldAddress: dto.oldAddress,
        newAddress: dto.newAddress,
        clientName: orderData.clientName,
        rk: orderData.rk,
        typeEquipment: orderData.typeEquipment,
        dateMeeting: orderData.dateMeeting,
        city: dto.city,
      },
    });
    results.push({ recipient: 'director', ...directorResult });

    if (dto.masterId) {
      const masterResult = await this.sendNotification({
        type: 'address_change',
        orderId: dto.orderId,
        masterId: dto.masterId,
        data: {
          oldAddress: dto.oldAddress,
          newAddress: dto.newAddress,
          clientName: orderData.clientName,
          rk: orderData.rk,
          typeEquipment: orderData.typeEquipment,
          dateMeeting: orderData.dateMeeting,
          city: dto.city,
        },
      });
      results.push({ recipient: 'master', ...masterResult });
    }

    return {
      success: results.every(r => r.success),
      message: 'Address change notifications sent',
      data: results,
    };
  }
}
