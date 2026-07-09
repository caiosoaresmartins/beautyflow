import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { toNumber } from '../common/helpers/decimal.helper';

@Injectable()
export class SalonsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSalonDto) {
    return this.prisma.salon.create({
      data: { ...dto },
    });
  }

  async findOne(id: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
      include: {
        professionals: {
          select: { id: true, name: true, role: true },
        },
        services: {
          where: { active: true },
          select: { id: true, name: true, durationMinutes: true, priceDefault: true },
        },
      },
    });
    if (!salon) throw new NotFoundException('Salao nao encontrado.');
    return salon;
  }

  async update(id: string, dto: UpdateSalonDto) {
    await this.findOne(id);
    return this.prisma.salon.update({
      where: { id },
      data: dto,
    });
  }

  async getStats(salonId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [bookingsToday, professionals, services, topServices] = await Promise.all([
      this.prisma.booking.findMany({
        where: { salonId, startsAt: { gte: today, lt: tomorrow }, deletedAt: null },
        include: {
          service: { select: { name: true, durationMinutes: true, priceDefault: true } },
        },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.professional.count({ where: { salonId } }),
      this.prisma.service.count({ where: { salonId, active: true } }),
      this.prisma.booking.groupBy({
        by: ['serviceId'],
        where: { salonId, status: 'COMPLETED', deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    const revenueToday = bookingsToday
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + toNumber(b.service?.priceDefault), 0);

    return {
      bookingsToday: bookingsToday.length,
      revenueToday,
      professionals,
      activeServices: services,
      topServices,
      schedule: bookingsToday,
    };
  }
}
