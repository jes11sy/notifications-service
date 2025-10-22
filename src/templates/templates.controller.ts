import { Controller, Get, Put, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TemplatesService } from './templates.service';
import { UpdateTemplateDto } from './dto/template.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get all message templates' })
  async getTemplates() {
    return this.templatesService.getTemplates();
  }

  @Get(':type')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get template by type' })
  async getTemplate(@Param('type') type: string) {
    return this.templatesService.getTemplate(type);
  }

  @Put(':type')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update message template' })
  async updateTemplate(@Param('type') type: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.updateTemplate(type, dto);
  }
}

