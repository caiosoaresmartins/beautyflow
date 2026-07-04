import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(salonId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const [totalClients, totalProfessionals, totalServices, bookingsToday, bookingsMonth, upcomingBookings] =
      await Promise.all([
        this.prisma.client.count({ where: { salonId } }),
        this.prisma.professional.count({ where: { salonId } }),
        this.prisma.service.count({ where: { salonId } }),
        this.prisma.booking.count({
          where: {
            salonId,
            scheduledAt: { gte: today, lt: tomorrow },
            status: { not: 'CANCELLED' },
          },
        }),
        this.prisma.booking.count({
          where: {
            salonId,
            scheduledAt: { gte: startOfMonth, lte: endOfMonth },
            status: { not: 'CANCELLED' },
          },
        }),
        this.prisma.booking.findMany({
          where: {
            salonId,
            scheduledAt: { gte: new Date() },
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          include: {
            client: true,
            service: true,
            professional: { include: { user: { select: { name: true } } } },
          },
          orderBy: { scheduledAt: 'asc' },
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
        status: 'COMPLETED',
        scheduledAt: { gte: startOfMonth },
      },
      include: { service: true },
    });

    const revenue = completedBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);
    return { revenue, completedBookings: completedBookings.length };
  }
}
