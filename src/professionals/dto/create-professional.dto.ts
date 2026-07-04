import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfessionalDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workingDays?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHoursStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHoursEnd?: string;
}
