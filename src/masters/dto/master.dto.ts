import { IsString, IsOptional, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMasterTelegramDto {
  @ApiProperty({ required: false, description: 'Telegram Chat ID мастера' })
  @IsString()
  @IsOptional()
  chatId?: string;
}

export class UpdateMasterCitiesDto {
  @ApiProperty({ type: [Number], description: 'ID городов из references_service' })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  cityIds: number[];
}
