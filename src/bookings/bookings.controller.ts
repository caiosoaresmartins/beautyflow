import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salons/:salonId/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all bookings with optional filters' })
  findAll(
    @Param('salonId') salonId: string,
    @Query('date') date?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
  ) {
    return this.bookingsService.findAll(salonId, { date, professionalId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by id' })
  findOne(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.bookingsService.findOne(id, salonId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  create(@Param('salonId') salonId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(salonId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a booking' })
  update(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(id, salonId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  updateStatus(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.bookingsService.updateStatus(id, salonId, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel/delete a booking' })
  remove(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.bookingsService.remove(id, salonId);
  }
}
