import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salons/:salonId/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all services of a salon' })
  findAll(@Param('salonId') salonId: string) {
    return this.servicesService.findAll(salonId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service by id' })
  findOne(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.servicesService.findOne(id, salonId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a service' })
  create(@Param('salonId') salonId: string, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(salonId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a service' })
  update(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, salonId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service' })
  remove(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.servicesService.remove(id, salonId);
  }
}
