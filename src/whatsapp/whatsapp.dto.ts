import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: '5511999999999' })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ example: 'Olá! Seu agendamento está confirmado.' })
  @IsString()
  @IsNotEmpty()
  text: string;
}
