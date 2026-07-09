import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { addMinutes, parseISO, setHours, setMinutes } from 'date-fns';

export interface CheckAvailabilityInput {
  salonId: string;
  serviceId: string;
  professionalId?: string;
  date: string; // YYYY-MM-DD
}

export interface AvailableSlot {
  professionalId: string;
  professionalName: string;
  startsAt: string; // ISO 8601 com timezone
  endsAt: string;
}

export interface CreateBookingAtomicInput {
  salonId: string;
  clientId: string;
  serviceId: string;
  professionalId: string;
  startsAt: Date;
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);
  private readonly TIMEZONE = 'America/Sao_Paulo';
  private readonly SLOT_GRANULARITY = 30; // minutos

  constructor(private readonly prisma: PrismaService) {}

  async checkAvailability(input: CheckAvailabilityInput): Promise<AvailableSlot[]> {
    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, salonId: input.salonId, active: true },
    });
    if (!service) return [];

    const duration = service.durationMinutes;

    const whereProf: any = { salonId: input.salonId };
    if (input.professionalId) whereProf.id = input.professionalId;

    const queryDate = new Date(input.date + 'T00:00:00Z');
    const nextDate = new Date(queryDate.getTime() + 24 * 60 * 60 * 1000);

    const professionals = await this.prisma.professional.findMany({
      where: whereProf,
      include: {
        workingHours: true,
        leaveBlocks: {
          where: {
            startsAt: { lte: nextDate },
            endsAt: { gte: queryDate },
          },
        },
      },
    });

    const dateInTz = toZonedTime(parseISO(input.date + 'T00:00:00'), this.TIMEZONE);
    const dayOfWeek = dateInTz.getDay();

    const slots: AvailableSlot[] = [];

    for (const prof of professionals) {
      if (prof.leaveBlocks.length > 0) continue;

      const wh = prof.workingHours.find((w: any) => w.dayOfWeek === dayOfWeek);
      if (!wh) continue;

      const startHour = parseInt(wh.startTime.split(':')[0]);
      const startMin = parseInt(wh.startTime.split(':')[1]);
      const endHour = parseInt(wh.endTime.split(':')[0]);
      const endMin = parseInt(wh.endTime.split(':')[1]);

      let current = setMinutes(setHours(dateInTz, startHour), startMin);
      const dayEnd = setMinutes(setHours(dateInTz, endHour), endMin);

      const dayStart = setMinutes(setHours(dateInTz, 0), 0);
      const dayEndFull = setMinutes(setHours(dateInTz, 23), 59);

      const existingBookings = await this.prisma.booking.findMany({
        where: {
          professionalId: prof.id,
          status: { not: 'CANCELLED' },
          startsAt: { gte: dayStart, lt: dayEndFull },
        },
        orderBy: { startsAt: 'asc' },
      });

      while (addMinutes(current, duration) <= dayEnd) {
        const slotEnd = addMinutes(current, duration);
        const hasConflict = existingBookings.some(
          (b) => current < b.endsAt && slotEnd > b.startsAt,
        );
        if (!hasConflict && current > new Date()) {
          slots.push({
            professionalId: prof.id,
            professionalName: prof.name,
            startsAt: formatInTimeZone(current, this.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssxxx"),
            endsAt: formatInTimeZone(slotEnd, this.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssxxx"),
          });
        }
        current = addMinutes(current, this.SLOT_GRANULARITY);
      }
    }

    return slots.slice(0, 10);
  }

  /**
   * Cria booking com protecao contra double-booking via SELECT FOR UPDATE NOWAIT.
   */
  async createBookingAtomic(input: CreateBookingAtomicInput): Promise<any> {
    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, salonId: input.salonId },
    });
    if (!service) throw new ConflictException('Servico nao encontrado');

    const endsAt = addMinutes(input.startsAt, service.durationMinutes);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const conflicts = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM bookings
          WHERE professional_id = ${input.professionalId}::uuid
          AND status != 'CANCELLED'
          AND starts_at < ${endsAt}
          AND ends_at > ${input.startsAt}
          FOR UPDATE NOWAIT
        `;

        if (conflicts.length > 0) {
          throw new ConflictException('Horario indisponivel - ja existe agendamento neste periodo');
        }

        const booking = await tx.booking.create({
          data: {
            salonId: input.salonId,
            clientId: input.clientId,
            serviceId: input.serviceId,
            professionalId: input.professionalId,
            startsAt: input.startsAt,
            endsAt,
            status: 'CONFIRMED',
          },
          include: {
            service: { select: { name: true } },
            professional: { select: { name: true } },
          },
        });

        return {
          success: true,
          bookingId: booking.id,
          service: booking.service.name,
          professional: booking.professional.name,
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
        };
      });
    } catch (err: any) {
      if (err?.code === '55P03') {
        throw new ConflictException(
          'Horario disputado simultaneamente - tente novamente em instantes',
        );
      }
      throw err;
    }
  }
}
