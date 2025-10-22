import { Controller, Get, Put, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DirectorsService } from './directors.service';
import { UpdateTelegramDto } from './dto/director.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('directors')
@Controller('directors')
export class DirectorsController {
  constructor(private directorsService: DirectorsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get all directors' })
  async getDirectors() {
    return this.directorsService.getDirectors();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get director by ID' })
  async getDirector(@Param('id') id: string) {
    return this.directorsService.getDirector(+id);
  }

  @Put(':id/telegram')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update director Telegram data' })
  async updateTelegram(@Param('id') id: string, @Body() dto: UpdateTelegramDto) {
    return this.directorsService.updateTelegram(+id, dto);
  }
}

