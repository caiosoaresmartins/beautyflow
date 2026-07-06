import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AvailableSlot {
  startsAt: Date;
  endsAt: Date;
  professionalId: string;
  professionalName: string;
}

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retorna slots disponíveis para um serviço num determinado dia.
   * Considera workingHours e leaveBlocks do profissional.
   */
  async getAvailableSlots(
    salonId: string,
    serviceId: string,
    date: string,
    professionalId?: string,
  ): Promise<AvailableSlot[]> {
    const service = await this.prisma.service.findFirstOrThrow({
      where: { id: serviceId, salonId, active: true },
    });

    const day = new Date(date);
    const dayOfWeek = day.getDay(); // 0=Dom, 6=Sab

    const professionalsQuery = await this.prisma.professional.findMany({
      where: {
        salonId,
        ...(professionalId ? { id: professionalId } : {}),
        workingHours: {
          some: { dayOfWeek, active: true },
        },
      },
      include: {
        workingHours: { where: { dayOfWeek, active: true } },
        leaveBlocks: {
          where: {
            startsAt: { lte: new Date(`${date}T23:59:59`) },
            endsAt: { gte: new Date(`${date}T00:00:00`) },
          },
        },
        bookings: {
          where: {
            startsAt: {
              gte: new Date(`${date}T00:00:00`),
              lte: new Date(`${date}T23:59:59`),
            },
            status: { not: 'CANCELLED' },
            deletedAt: null,
          },
        },
      },
    });

    const durationMs = service.durationMinutes * 60_000;
    const slotIntervalMs = 15 * 60_000; // slots a cada 15 min
    const slots: AvailableSlot[] = [];

    for (const professional of professionalsQuery) {
      for (const wh of professional.workingHours) {
        const [startH, startM] = wh.startTime.split(':').map(Number);
        const [endH, endM] = wh.endTime.split(':').map(Number);

        const whStart = new Date(date);
        whStart.setHours(startH, startM, 0, 0);
        const whEnd = new Date(date);
        whEnd.setHours(endH, endM, 0, 0);

        let cursor = whStart.getTime();

        while (cursor + durationMs <= whEnd.getTime()) {
          const slotStart = new Date(cursor);
          const slotEnd = new Date(cursor + durationMs);

          // Verifica conflito com leaveBlocks
          const blockedByLeave = professional.leaveBlocks.some(
            (lb) => lb.startsAt < slotEnd && lb.endsAt > slotStart,
          );

          // Verifica conflito com bookings existentes
          const blockedByBooking = professional.bookings.some(
            (b) => b.startsAt < slotEnd && b.endsAt > slotStart,
          );

          if (!blockedByLeave && !blockedByBooking) {
            slots.push({
              startsAt: slotStart,
              endsAt: slotEnd,
              professionalId: professional.id,
              professionalName: professional.name,
            });
          }

          cursor += slotIntervalMs;
        }
      }
    }

    return slots;
  }
}
