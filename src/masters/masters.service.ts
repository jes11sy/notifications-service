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
        login: true,
        cities: true,
        statusWork: true,
        tgId: true,
        chatId: true,
        dateCreate: true,
        note: true,
        createdAt: true,
        updatedAt: true,
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
        login: true,
        cities: true,
        statusWork: true,
        tgId: true,
        chatId: true,
        passportDoc: true,
        contractDoc: true,
        dateCreate: true,
        note: true,
        createdAt: true,
        updatedAt: true,
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
        tgId: dto.tgId !== undefined ? dto.tgId : master.tgId,
        chatId: dto.chatId !== undefined ? dto.chatId : master.chatId,
      },
      select: {
        id: true,
        name: true,
        tgId: true,
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
        cities: dto.cities,
      },
      select: {
        id: true,
        name: true,
        cities: true,
      },
    });

    return {
      success: true,
      message: 'Master cities updated successfully',
      data: updated,
    };
  }

  async getMastersByCities(cities: string[]) {
    const masters = await this.prisma.master.findMany({
      where: {
        cities: { hasSome: cities },
        tgId: { not: null },
      },
      select: {
        id: true,
        name: true,
        cities: true,
        tgId: true,
        chatId: true,
      },
    });

    return {
      success: true,
      data: masters,
    };
  }
}

