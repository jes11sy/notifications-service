import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto, NewOrderNotificationDto, DateChangeNotificationDto, OrderRejectionNotificationDto } from './dto/notification.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private notificationsService: NotificationsService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    return {
      success: true,
      message: 'Notifications module is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send generic notification (internal)' })
  async send(@Body() dto: SendNotificationDto) {
    // Проверяем webhook token
    const webhookToken = process.env.WEBHOOK_TOKEN || 'your-webhook-secret';
    if (dto.token !== webhookToken) {
      return {
        success: false,
        message: 'Invalid webhook token',
      };
    }

    return this.notificationsService.sendNotification(dto);
  }

  @Post('new-order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send new order notification (webhook)' })
  async newOrder(@Body() dto: NewOrderNotificationDto) {
    this.logger.log(`New order notification: ${JSON.stringify(dto)}`);
    
    // Проверяем webhook token
    const webhookToken = process.env.WEBHOOK_TOKEN || 'your-webhook-secret';
    if (dto.token !== webhookToken) {
      return {
        success: false,
        message: 'Invalid webhook token',
      };
    }

    return this.notificationsService.sendNewOrderNotification(dto);
  }

  @Post('date-change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send date change notification (webhook)' })
  async dateChange(@Body() dto: DateChangeNotificationDto) {
    this.logger.log(`Date change notification: ${JSON.stringify(dto)}`);
    
    const webhookToken = process.env.WEBHOOK_TOKEN || 'your-webhook-secret';
    if (dto.token !== webhookToken) {
      return {
        success: false,
        message: 'Invalid webhook token',
      };
    }

    return this.notificationsService.sendDateChangeNotification(dto);
  }

  @Post('order-rejection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send order rejection notification (webhook)' })
  async orderRejection(@Body() dto: OrderRejectionNotificationDto) {
    this.logger.log(`Order rejection notification: ${JSON.stringify(dto)}`);
    
    const webhookToken = process.env.WEBHOOK_TOKEN || 'your-webhook-secret';
    if (dto.token !== webhookToken) {
      return {
        success: false,
        message: 'Invalid webhook token',
      };
    }

    return this.notificationsService.sendOrderRejectionNotification(dto);
  }

  @Get('history')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get notifications history' })
  async getHistory(@Query() query: any) {
    return this.notificationsService.getHistory(query);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get notifications statistics' })
  async getStats(@Query() query: any) {
    return this.notificationsService.getStats(query);
  }
}

