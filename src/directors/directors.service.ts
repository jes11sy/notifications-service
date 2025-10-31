import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTelegramDto } from './dto/director.dto';

@Injectable()
export class DirectorsService {
  constructor(private prisma: PrismaService) {}

  async getDirectors() {
    const directors = await this.prisma.director.findMany({
      select: {
        id: true,
        name: true,
        cities: true,
        tgId: true,
        dateCreate: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: directors,
    };
  }

  async getDirector(id: number) {
    const director = await this.prisma.director.findUnique({
      where: { id },
    });

    if (!director) {
      throw new NotFoundException('Director not found');
    }

    return {
      success: true,
      data: director,
    };
  }

  async updateTelegram(id: number, dto: UpdateTelegramDto) {
    const director = await this.prisma.director.update({
      where: { id },
      data: {
        tgId: dto.tgId,
      },
    });

    return {
      success: true,
      message: 'Telegram data updated successfully',
      data: director,
    };
  }
}

