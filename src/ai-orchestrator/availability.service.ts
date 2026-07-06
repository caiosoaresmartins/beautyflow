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
  startsAt: string; // ISO 8601 local
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
  // Granularidade dos slots em minutos
  private readonly SLOT_GRANULARITY = 30;

  constructor(private readonly prisma: PrismaService) {}

  async checkAvailability(input: CheckAvailabilityInput): Promise<AvailableSlot[]> {
    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, salonId: input.salonId, active: true },
    });
    if (!service) return [];

    const duration = service.durationMinutes;

    // Profissionais que atendem este serviço
    const whereProf: any = { salonId: input.salonId };
    if (input.professionalId) whereProf.id = input.professionalId;

    const professionals = await this.prisma.professional.findMany({
      where: whereProf,
      include: {
        workingHours: true,
        leaveBlocks: {
          where: {
            startDate: { lte: new Date(input.date) },
            endDate: { gte: new Date(input.date) },
          },
        },
      },
    });

    // Data no timezone correto
    const dateInTz = toZonedTime(parseISO(input.date + 'T00:00:00'), this.TIMEZONE);
    const dayOfWeek = dateInTz.getDay(); // 0=Dom, 6=Sáb

    const slots: AvailableSlot[] = [];

    for (const prof of professionals) {
      // Verificar se está de folga
      if (prof.leaveBlocks.length > 0) continue;

      // Buscar horário de trabalho para o dia da semana
      const wh = prof.workingHours.find((w: any) => w.weekday === dayOfWeek);
      if (!wh || !wh.active) continue;

      const startHour = parseInt(wh.startTime.split(':')[0]);
      const startMin = parseInt(wh.startTime.split(':')[1]);
      const endHour = parseInt(wh.endTime.split(':')[0]);
      const endMin = parseInt(wh.endTime.split(':')[1]);

      let current = setMinutes(setHours(dateInTz, startHour), startMin);
      const dayEnd = setMinutes(setHours(dateInTz, endHour), endMin);

      // Buscar agendamentos existentes do profissional nesta data
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

      // Iterar slots
      while (addMinutes(current, duration) <= dayEnd) {
        const slotEnd = addMinutes(current, duration);

        // Verificar conflito com agendamentos existentes
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

    return slots.slice(0, 10); // Retornar no máximo 10 slots para a IA
  }

  /** Cria booking com SELECT FOR UPDATE NOWAIT para prevenir double-booking */
  async createBookingAtomic(input: CreateBookingAtomicInput): Promise<any> {
    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, salonId: input.salonId },
    });
    if (!service) throw new ConflictException('Serviço não encontrado');

    const endsAt = addMinutes(input.startsAt, service.durationMinutes);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE NOWAIT via query raw — previne double-booking
        await tx.$queryRaw`
          SELECT id FROM bookings
          WHERE professional_id = ${input.professionalId}
            AND status != 'CANCELLED'
            AND starts_at < ${endsAt}
            AND ends_at > ${input.startsAt}
          FOR UPDATE NOWAIT
        `;

        // Se chegou aqui sem erro, slot está livre — criar booking
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
      // Lock NOWAIT: outro agendamento conflitante
      if (err?.code === '55P03') {
        throw new ConflictException('Horário indisponível — acabou de ser agendado por outro cliente');
      }
      throw err;
    }
  }
}
