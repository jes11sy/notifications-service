import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMasterTelegramDto {
  @ApiProperty({ required: false, description: 'Telegram ID мастера' })
  @IsString()
  @IsOptional()
  tgId?: string;

  @ApiProperty({ required: false, description: 'Telegram Chat ID мастера' })
  @IsString()
  @IsOptional()
  chatId?: string;
}

export class UpdateMasterCitiesDto {
  @ApiProperty({ type: [String], description: 'Список городов' })
  @IsArray()
  cities: string[];
}

