import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfessionalRole } from '@prisma/client';

export class CreateProfessionalDto {
  @ApiProperty({ example: 'Ana Souza' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'ana@beautyflow.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Senha@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '+5511999990000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Especialista em coloração' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ enum: ProfessionalRole, default: ProfessionalRole.PROFESSIONAL })
  @IsOptional()
  @IsEnum(ProfessionalRole)
  role?: ProfessionalRole = ProfessionalRole.PROFESSIONAL;
}
