import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async getTemplates() {
    const templates = await this.prisma.messageTemplate.findMany({
      orderBy: { type: 'asc' },
    });

    return {
      success: true,
      data: templates,
    };
  }

  async getTemplate(type: string) {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { type },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return {
      success: true,
      data: template,
    };
  }

  async updateTemplate(type: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.messageTemplate.upsert({
      where: { type },
      update: {
        template: dto.template,
        enabled: dto.enabled ?? true,
      },
      create: {
        type,
        template: dto.template,
        enabled: dto.enabled ?? true,
      },
    });

    return {
      success: true,
      message: 'Template updated successfully',
      data: template,
    };
  }

  async initializeDefaultTemplates() {
    const defaultTemplates = [
      {
        type: 'new_order',
        template: `🆕 Новая заявка #{orderId}

👤 Клиент: {clientName}
📞 Телефон: {phone}
📍 Адрес: {address}
🗓 Дата встречи: {dateMeeting}
🔧 Проблема: {problem}
🏙 Город: {city}
📋 РК: {rk}`,
        enabled: true,
      },
      {
        type: 'date_change',
        template: `📅 Перенос даты встречи

📋 Заявка #{orderId}
👤 Клиент: {clientName}
🗓 Старая дата: {oldDate}
🗓 Новая дата: {newDate}
🏙 Город: {city}`,
        enabled: true,
      },
      {
        type: 'order_rejection',
        template: `❌ Отказ от заявки

📋 Заявка #{orderId}
👤 Клиент: {clientName}
📞 Телефон: {phone}
💬 Причина: {reason}
🏙 Город: {city}`,
        enabled: true,
      },
    ];

    for (const template of defaultTemplates) {
      await this.prisma.messageTemplate.upsert({
        where: { type: template.type },
        update: {},
        create: template,
      });
    }
  }
}

