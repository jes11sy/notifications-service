import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMasterTelegramDto, UpdateMasterCitiesDto } from './dto/master.dto';

@Injectable()
export class MastersService {
  constructor(private prisma: PrismaService) {}

  async getAllMasters() {
    const masters = await this.prisma.master.findMany({
      select: {
        id: true,
        name: true,
        cityIds: true,
        status: true,
        chatId: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: masters,
    };
  }

  async getMasterById(id: number) {
    const master = await this.prisma.master.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        cityIds: true,
        status: true,
        chatId: true,
        createdAt: true,
      },
    });

    if (!master) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    return {
      success: true,
      data: master,
    };
  }

  async updateMasterTelegram(id: number, dto: UpdateMasterTelegramDto) {
    const master = await this.prisma.master.findUnique({
      where: { id },
    });

    if (!master) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    const updated = await this.prisma.master.update({
      where: { id },
      data: {
        chatId: dto.chatId !== undefined ? dto.chatId : master.chatId,
      },
      select: {
        id: true,
        name: true,
        chatId: true,
      },
    });

    return {
      success: true,
      message: 'Master Telegram data updated successfully',
      data: updated,
    };
  }

  async updateMasterCities(id: number, dto: UpdateMasterCitiesDto) {
    const master = await this.prisma.master.findUnique({
      where: { id },
    });

    if (!master) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    const updated = await this.prisma.master.update({
      where: { id },
      data: {
        cityIds: dto.cityIds,
      },
      select: {
        id: true,
        name: true,
        cityIds: true,
      },
    });

    return {
      success: true,
      message: 'Master cities updated successfully',
      data: updated,
    };
  }

  async getMastersByCityIds(cityIds: number[]) {
    const masters = await this.prisma.master.findMany({
      where: {
        cityIds: { hasSome: cityIds },
        chatId: { not: null },
      },
      select: {
        id: true,
        name: true,
        cityIds: true,
        chatId: true,
      },
    });

    return {
      success: true,
      data: masters,
    };
  }
}
