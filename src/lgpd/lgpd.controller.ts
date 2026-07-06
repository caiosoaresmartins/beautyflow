import { Controller, Post, Get, Delete, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LgpdService } from './lgpd.service';

@ApiTags('lgpd')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salons/:salonId/clients/:clientId/lgpd')
export class LgpdController {
  constructor(private readonly lgpdService: LgpdService) {}

  @ApiOperation({ summary: 'Opt-out: cliente solicita parar de receber mensagens' })
  @Post('opt-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async optOut(@Param('clientId') clientId: string, @Param('salonId') salonId: string) {
    return this.lgpdService.optOut(clientId, salonId);
  }

  @ApiOperation({ summary: 'Exportação de dados pessoais (Art. 18 LGPD)' })
  @Get('export')
  async exportData(@Param('clientId') clientId: string, @Param('salonId') salonId: string) {
    return this.lgpdService.exportClientData(clientId, salonId);
  }

  @ApiOperation({ summary: 'Anonimização de dados pessoais (Art. 16 LGPD)' })
  @Delete('anonymize')
  @HttpCode(HttpStatus.NO_CONTENT)
  async anonymize(@Param('clientId') clientId: string, @Param('salonId') salonId: string) {
    return this.lgpdService.anonymizeClient(clientId, salonId);
  }
}
