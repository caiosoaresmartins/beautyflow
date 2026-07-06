import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateServiceDto {
  @ApiProperty({ example: 'Corte Masculino' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Corte social ou degradê com acabamento' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Corte' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 45, description: 'Duração em minutos' })
  @IsNumber()
  @Min(1)
  @Max(480)
  durationMinutes: number;

  @ApiProperty({ example: 50.00, description: 'Preço padrão do serviço (R$)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  priceDefault: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
