import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTelegramDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  tgId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  chatId?: string;
}

