import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(salonId: string, filters?: { date?: string; professionalId?: string; status?: string }) {
    const where: any = { salonId };
    if (filters?.professionalId) where.professionalId = filters.professionalId;
    if (filters?.status) where.status = filters.status;
    if (filters?.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }
    return this.prisma.booking.findMany({
      where,
      include: {
        client: true,
        professional: { include: { user: { select: { name: true } } } },
        service: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string, salonId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, salonId },
      include: {
        client: true,
        professional: { include: { user: { select: { name: true } } } },
        service: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async create(salonId: string, dto: CreateBookingDto) {
    const service = await this.prisma.service.findFirst({ where: { id: dto.serviceId, salonId } });
    if (!service) throw new BadRequestException('Service not found in this salon');
    const professional = await this.prisma.professional.findFirst({ where: { id: dto.professionalId, salonId } });
    if (!professional) throw new BadRequestException('Professional not found in this salon');
    const scheduledAt = new Date(dto.scheduledAt);
    const endAt = new Date(scheduledAt.getTime() + service.durationMinutes * 60000);
    const conflict = await this.prisma.booking.findFirst({
      where: {
        professionalId: dto.professionalId,
        status: { not: 'CANCELLED' },
        scheduledAt: { lt: endAt },
        endAt: { gt: scheduledAt },
      },
    });
    if (conflict) throw new BadRequestException('Professional already has a booking at this time');
    return this.prisma.booking.create({
      data: { ...dto, salonId, scheduledAt, endAt },
      include: { client: true, service: true, professional: { include: { user: { select: { name: true } } } } },
    });
  }

  async updateStatus(id: string, salonId: string, status: string) {
    await this.findOne(id, salonId);
    return this.prisma.booking.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async update(id: string, salonId: string, dto: UpdateBookingDto) {
    await this.findOne(id, salonId);
    return this.prisma.booking.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, salonId: string) {
    await this.findOne(id, salonId);
    return this.prisma.booking.delete({ where: { id } });
  }
}
