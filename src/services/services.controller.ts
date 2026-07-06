import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { ProfessionalRole } from '@prisma/client';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salons/:salonId/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // -----------------------------------------------------------
  // CRUD principal
  // -----------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'Listar serviços do salão (paginado, apenas ativos por padrão)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAll(
    @Param('salonId') salonId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.servicesService.findAll(salonId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      includeInactive: includeInactive === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar serviço por ID' })
  findOne(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.servicesService.findOne(id, salonId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(ProfessionalRole.OWNER)
  @ApiOperation({ summary: 'Criar serviço (somente OWNER)' })
  create(@Param('salonId') salonId: string, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(salonId, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(ProfessionalRole.OWNER)
  @ApiOperation({ summary: 'Atualizar serviço (somente OWNER)' })
  update(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, salonId, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(ProfessionalRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativar serviço — soft delete (somente OWNER)' })
  remove(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.servicesService.remove(id, salonId);
  }

  // -----------------------------------------------------------
  // Vínculos Profissional <-> Serviço
  // -----------------------------------------------------------

  @Post(':id/professionals/:professionalId')
  @UseGuards(RolesGuard)
  @Roles(ProfessionalRole.OWNER)
  @ApiOperation({ summary: 'Vincular profissional a um serviço (somente OWNER)' })
  assignProfessional(
    @Param('salonId') salonId: string,
    @Param('id') serviceId: string,
    @Param('professionalId') professionalId: string,
  ) {
    return this.servicesService.assignProfessional(serviceId, professionalId, salonId);
  }

  @Delete(':id/professionals/:professionalId')
  @UseGuards(RolesGuard)
  @Roles(ProfessionalRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desvincular profissional de um serviço (somente OWNER)' })
  removeProfessional(
    @Param('salonId') salonId: string,
    @Param('id') serviceId: string,
    @Param('professionalId') professionalId: string,
  ) {
    return this.servicesService.removeProfessional(serviceId, professionalId, salonId);
  }
}
