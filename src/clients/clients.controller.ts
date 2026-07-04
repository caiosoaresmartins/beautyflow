import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salons/:salonId/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List all clients of a salon' })
  findAll(@Param('salonId') salonId: string, @Query('q') query?: string) {
    if (query) return this.clientsService.search(salonId, query);
    return this.clientsService.findAll(salonId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a client by id' })
  findOne(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.clientsService.findOne(id, salonId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a client' })
  create(@Param('salonId') salonId: string, @Body() dto: CreateClientDto) {
    return this.clientsService.create(salonId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a client' })
  update(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, salonId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a client' })
  remove(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.clientsService.remove(id, salonId);
  }
}
