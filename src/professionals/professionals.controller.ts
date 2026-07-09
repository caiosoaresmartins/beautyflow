import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfessionalsService } from './professionals.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

@ApiTags('professionals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salons/:salonId/professionals')
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Get()
  @ApiOperation({ summary: 'List all professionals of a salon' })
  findAll(
    @Param('salonId') salonId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.professionalsService.findAll(salonId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a professional by id' })
  findOne(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.professionalsService.findOne(id, salonId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a professional' })
  create(@Param('salonId') salonId: string, @Body() dto: CreateProfessionalDto) {
    return this.professionalsService.create(salonId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a professional' })
  update(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
  ) {
    return this.professionalsService.update(id, salonId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a professional' })
  remove(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.professionalsService.remove(id, salonId);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get professional schedule for a date' })
  getSchedule(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    return this.professionalsService.getSchedule(id, salonId, date);
  }
}
