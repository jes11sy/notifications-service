import { IsString, IsNumber, IsOptional, IsIn, IsDateString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({ enum: ['new_order', 'date_change', 'order_rejection'] })
  @IsString()
  @IsIn(['new_order', 'date_change', 'order_rejection'])
  type: string;

  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

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

  @ApiProperty()
  @IsString()
  token: string;
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

  @ApiProperty()
  @IsString()
  token: string;
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

  @ApiProperty()
  @IsString()
  token: string;
}

