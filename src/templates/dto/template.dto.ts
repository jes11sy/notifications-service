import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTemplateDto {
  @ApiProperty()
  @IsString()
  template: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

