import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfessionalRole } from '@prisma/client';

export class RegisterProfessionalDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'joao@salao.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Barbearia do João', description: 'Nome do salão (obrigatório para role OWNER)' })
  @IsOptional()
  @IsString()
  salonName?: string;

  @ApiPropertyOptional({ example: 'cl0abc123', description: 'ID do salão (para profissionais que já existem)' })
  @IsOptional()
  @IsString()
  salonId?: string;

  @ApiPropertyOptional({ enum: ProfessionalRole, default: ProfessionalRole.OWNER })
  @IsOptional()
  @IsEnum(ProfessionalRole)
  role?: ProfessionalRole;
}
