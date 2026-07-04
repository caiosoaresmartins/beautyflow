import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProfessionalRoleEnum {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  PROFESSIONAL = 'PROFESSIONAL',
}

export class RegisterProfessionalDto {
  @ApiProperty({ example: 'Joao Silva' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'joao@salao.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'clxyz123' })
  @IsString()
  salonId: string;

  @ApiPropertyOptional({ enum: ProfessionalRoleEnum, default: ProfessionalRoleEnum.OWNER })
  @IsOptional()
  @IsEnum(ProfessionalRoleEnum)
  role?: string;
}
