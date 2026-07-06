import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  async getStats(salonId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalClients,
      totalProfessionals,
      totalServices,
      bookingsToday,
      bookingsMonth,
      upcomingBookings,
    ] = await Promise.all([
      this.prisma.client.count({ where: { salonId, deletedAt: null } }),
      this.prisma.professional.count({ where: { salonId } }),
      this.prisma.service.count({ where: { salonId, active: true } }),
      this.prisma.booking.count({
        where: {
          salonId,
          startsAt: { gte: today, lt: tomorrow },
          status: { not: BookingStatus.CANCELLED },
        },
      }),
      this.prisma.booking.count({
        where: {
          salonId,
          startsAt: { gte: startOfMonth, lte: endOfMonth },
          status: { not: BookingStatus.CANCELLED },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          salonId,
          startsAt: { gte: new Date() },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
        },
        include: {
          client: true,
          service: true,
          professional: { select: { id: true, name: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 5,
      }),
    ]);

    return {
      totalClients,
      totalProfessionals,
      totalServices,
      bookingsToday,
      bookingsMonth,
      upcomingBookings,
    };
  }

  async getRevenueStats(salonId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const completedBookings = await this.prisma.booking.findMany({
      where: {
        salonId,
        status: BookingStatus.COMPLETED,
        startsAt: { gte: startOfMonth },
      },
      include: { service: true },
    });

    // Decimal do Prisma não é número JS — converter com Number()
    const revenue = completedBookings.reduce((sum, b) => {
      const price = b.service?.priceDefault ? Number(b.service.priceDefault) : 0;
      return sum + price;
    }, 0);

    return {
      revenue: Math.round(revenue * 100) / 100,
      completedBookings: completedBookings.length,
    };
  }
}
