import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';

@Injectable()
export class SalonsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSalonDto) {
    return this.prisma.salon.create({ data: dto });
  }

  async findOne(id: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
      include: {
        professionals: { select: { id: true, name: true, role: true } },
        services: {
          where: { active: true },
          select: { id: true, name: true, durationMinutes: true, priceDefault: true, category: true },
        },
      },
    });
    if (!salon) throw new NotFoundException('Salão não encontrado');
    return salon;
  }

  async update(id: string, dto: UpdateSalonDto) {
    await this.findOne(id);
    return this.prisma.salon.update({ where: { id }, data: dto });
  }

  async getStats(salonId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [bookingsToday, totalClients, totalBookings] = await Promise.all([
      this.prisma.booking.count({
        where: { salonId, startsAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.client.count({ where: { salonId, deletedAt: null } }),
      this.prisma.booking.count({ where: { salonId } }),
    ]);

    return { bookingsToday, totalClients, totalBookings };
  }
}
