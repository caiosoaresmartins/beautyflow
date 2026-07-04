import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalonsService } from './salons.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('salons')
@Controller('salons')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalonsController {
  constructor(private salonsService: SalonsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo salao' })
  create(@Body() dto: CreateSalonDto) {
    return this.salonsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar salao por ID' })
  findOne(@Param('id') id: string) {
    return this.salonsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar salao' })
  update(@Param('id') id: string, @Body() dto: UpdateSalonDto) {
    return this.salonsService.update(id, dto);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Estatisticas do salao' })
  getStats(@Param('id') id: string) {
    return this.salonsService.getStats(id);
  }

  @Get('me/profile')
  @ApiOperation({ summary: 'Salao do usuario logado' })
  getMyProfile(@Request() req) {
    return this.salonsService.findOne(req.user.salonId);
  }
}
