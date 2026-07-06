import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'ID do cliente' })
  @IsString()
  clientId: string;

  @ApiProperty({ description: 'ID do profissional' })
  @IsString()
  professionalId: string;

  @ApiProperty({ description: 'ID do serviço' })
  @IsString()
  serviceId: string;

  @ApiProperty({ example: '2024-12-25T10:00:00.000Z', description: 'Data e hora de início (ISO 8601 UTC)' })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional({ description: 'ID da assinatura (se pagamento via plano)' })
  @IsOptional()
  @IsString()
  subscriptionId?: string;
}
