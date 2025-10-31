import { Controller, Get, Put, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MastersService } from './masters.service';
import { UpdateMasterTelegramDto, UpdateMasterCitiesDto } from './dto/master.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('masters')
@Controller('masters')
export class MastersController {
  constructor(private mastersService: MastersService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get all masters' })
  async getAllMasters() {
    return this.mastersService.getAllMasters();
  }

  @Get('by-cities')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get masters by cities' })
  async getMastersByCities(@Query('cities') cities: string) {
    const cityArray = cities.split(',').map(c => c.trim());
    return this.mastersService.getMastersByCities(cityArray);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master by ID' })
  async getMasterById(@Param('id') id: string) {
    return this.mastersService.getMasterById(+id);
  }

  @Put(':id/telegram')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Update master Telegram data' })
  async updateMasterTelegram(
    @Param('id') id: string,
    @Body() dto: UpdateMasterTelegramDto,
  ) {
    return this.mastersService.updateMasterTelegram(+id, dto);
  }

  @Put(':id/cities')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Update master cities' })
  async updateMasterCities(
    @Param('id') id: string,
    @Body() dto: UpdateMasterCitiesDto,
  ) {
    return this.mastersService.updateMasterCities(+id, dto);
  }
}

