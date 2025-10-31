import { IsString, IsNumber, IsOptional, IsIn, IsDateString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Типы уведомлений
export const NotificationTypes = [
  'new_order',           // Новый заказ (директор)
  'date_change',         // Изменение даты (директор + мастер если назначен)
  'order_rejection',     // Отказ от заказа (директор + мастер если назначен)
  'master_assigned',     // Мастер назначен на заказ (мастер)
  'master_reassigned',   // Заказ передан другому мастеру (старый мастер)
  'order_accepted',      // Заказ принят мастером (мастер)
  'order_closed',        // Заказ закрыт (мастер)
  'order_in_modern',     // Заказ в модерне (мастер)
  'close_order_reminder',     // Напоминание закрыть заказ (мастер)
  'modern_closing_reminder',  // Напоминание о закрытии модерна (мастер)
] as const;

export type NotificationType = typeof NotificationTypes[number];

export class SendNotificationDto {
  @ApiProperty({ enum: NotificationTypes })
  @IsString()
  @IsIn(NotificationTypes)
  type: NotificationType;

  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  masterId?: number;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

// DTO для уведомлений директорам
export class NewOrderNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  clientName: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsDateString()
  dateMeeting: string;

  @ApiProperty()
  @IsString()
  problem: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rk?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  avitoName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  typeEquipment?: string;
}

export class DateChangeNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  clientName: string;

  @ApiProperty()
  @IsDateString()
  newDate: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  oldDate?: string;

  @ApiProperty({ required: false, description: 'ID мастера, если назначен на заказ' })
  @IsNumber()
  @IsOptional()
  masterId?: number;
}

export class OrderRejectionNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  clientName: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty({ required: false, description: 'ID мастера, если назначен на заказ' })
  @IsNumber()
  @IsOptional()
  masterId?: number;
}

// DTO для уведомлений мастерам
export class MasterAssignedNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsNumber()
  masterId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rk?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  avitoName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  typeEquipment?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  dateMeeting?: string;
}

export class MasterReassignedNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsNumber()
  oldMasterId: number;
}

export class OrderAcceptedNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsNumber()
  masterId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientName?: string;
}

export class OrderClosedNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsNumber()
  masterId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientName?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  closingDate?: string;
}

export class OrderInModernNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsNumber()
  masterId: number;

  @ApiProperty()
  @IsDateString()
  expectedClosingDate: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientName?: string;
}

export class CloseOrderReminderNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsNumber()
  masterId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientName?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  daysOverdue?: number;
}

export class ModernClosingReminderNotificationDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsNumber()
  masterId: number;

  @ApiProperty()
  @IsDateString()
  expectedClosingDate: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientName?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  daysUntilClosing?: number;
}

