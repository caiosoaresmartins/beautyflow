import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/helpers/decimal.helper';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(salonId: string, period: 'day' | 'week' | 'month' = 'month') {
    const now = new Date();
    const start = new Date(now);

    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    const [completedBookings, pendingBookings, cancelledBookings, newClients, totalProfessionals] =
      await Promise.all([
        this.prisma.booking.findMany({
          where: { salonId, status: 'COMPLETED', startsAt: { gte: start }, deletedAt: null },
          include: { service: { select: { priceDefault: true } } },
        }),
        this.prisma.booking.count({
          where: { salonId, status: 'PENDING', startsAt: { gte: start }, deletedAt: null },
        }),
        this.prisma.booking.count({
          where: { salonId, status: 'CANCELLED', startsAt: { gte: start } },
        }),
        this.prisma.client.count({
          where: { salonId, createdAt: { gte: start }, deletedAt: null },
        }),
        this.prisma.professional.count({ where: { salonId } }),
      ]);

    const revenue = completedBookings.reduce((sum, b) => {
      return sum + toNumber(b.service?.priceDefault);
    }, 0);

    const completionRate =
      completedBookings.length + pendingBookings + cancelledBookings > 0
        ? (completedBookings.length / (completedBookings.length + pendingBookings + cancelledBookings)) * 100
        : 0;

    return {
      period,
      revenue: Number(revenue.toFixed(2)),
      completedBookings: completedBookings.length,
      pendingBookings,
      cancelledBookings,
      newClients,
      totalProfessionals,
      completionRate: Number(completionRate.toFixed(1)),
    };
  }

  async getRevenueChart(salonId: string, days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const bookings = await this.prisma.booking.findMany({
      where: {
        salonId,
        status: 'COMPLETED',
        startsAt: { gte: start },
        deletedAt: null,
      },
      select: {
        startsAt: true,
        service: { select: { priceDefault: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    // Agrupa por dia
    const map = new Map<string, number>();
    for (const b of bookings) {
      const key = b.startsAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + toNumber(b.service?.priceDefault));
    }

    return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue }));
  }
}
