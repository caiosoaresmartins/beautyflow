import { IsString, IsEmail, IsOptional, MinLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfessionalRole } from '@prisma/client';

export class CreateProfessionalDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'joao@barbearia.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '+5511999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Especialista em cortes degradê' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ enum: ProfessionalRole, default: ProfessionalRole.PROFESSIONAL })
  @IsOptional()
  @IsEnum(ProfessionalRole)
  role?: ProfessionalRole;
}
