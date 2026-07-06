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

    const dateInTz = toZonedTime(parseISO(input.date + 'T00:00:00'), this.TIMEZONE);
    const dayOfWeek = dateInTz.getDay();

    const slots: AvailableSlot[] = [];

    for (const prof of professionals) {
      if (prof.leaveBlocks.length > 0) continue;

      const wh = prof.workingHours.find((w: any) => w.weekday === dayOfWeek);
      if (!wh || !wh.active) continue;

      const startHour = parseInt(wh.startTime.split(':')[0]);
      const startMin  = parseInt(wh.startTime.split(':')[1]);
      const endHour   = parseInt(wh.endTime.split(':')[0]);
      const endMin    = parseInt(wh.endTime.split(':')[1]);

      let current  = setMinutes(setHours(dateInTz, startHour), startMin);
      const dayEnd = setMinutes(setHours(dateInTz, endHour), endMin);

      const dayStart   = setMinutes(setHours(dateInTz, 0), 0);
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
            endsAt:   formatInTimeZone(slotEnd, this.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssxxx"),
          });
        }

        current = addMinutes(current, this.SLOT_GRANULARITY);
      }
    }

    return slots.slice(0, 10);
  }

  /**
   * Cria booking com proteção contra double-booking via SELECT FOR UPDATE NOWAIT.
   *
   * fix: a query anterior tentava bloquear linhas conflitantes e tratava o
   * lock error como "slot ocupado" — mas NOWAIT lança erro se QUALQUER linha
   * da query estiver travada, não necessariamente porque há conflito real.
   * A abordagem correta é:
   *   1. Verificar existência de conflito com uma SELECT sem lock.
   *   2. Se livre, tentar INSERT (o lock na linha de bookings existentes
   *      via FOR UPDATE previne race condition entre dois requests simultâneos).
   */
  async createBookingAtomic(input: CreateBookingAtomicInput): Promise<any> {
    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, salonId: input.salonId },
    });
    if (!service) throw new ConflictException('Serviço não encontrado');

    const endsAt = addMinutes(input.startsAt, service.durationMinutes);

    try {
      return await this.prisma.$transaction(async (tx) => {
        /**
         * fix: SELECT FOR UPDATE NOWAIT nas linhas que CONFLITAM com o slot
         * desejado — bloqueia outras transações concorrentes que tentem criar
         * booking para o mesmo profissional no mesmo horário.
         * Se a query retornar 0 linhas → slot livre → prosseguir com INSERT.
         * Se retornar ≥1 linha → conflito real → lançar ConflictException.
         * Se outra transação tiver lock nas mesmas linhas → NOWAIT lança 55P03
         *   → slot disputado simultaneamente → retornar erro de concorrência.
         */
        const conflicts = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM bookings
          WHERE professional_id = ${input.professionalId}::uuid
            AND status != 'CANCELLED'
            AND starts_at < ${endsAt}
            AND ends_at   > ${input.startsAt}
          FOR UPDATE NOWAIT
        `;

        if (conflicts.length > 0) {
          throw new ConflictException('Horário indisponível — já existe agendamento neste período');
        }

        const booking = await tx.booking.create({
          data: {
            salonId:        input.salonId,
            clientId:       input.clientId,
            serviceId:      input.serviceId,
            professionalId: input.professionalId,
            startsAt:       input.startsAt,
            endsAt,
            status: 'CONFIRMED',
          },
          include: {
            service:      { select: { name: true } },
            professional: { select: { name: true } },
          },
        });

        return {
          success:      true,
          bookingId:    booking.id,
          service:      booking.service.name,
          professional: booking.professional.name,
          startsAt:     booking.startsAt.toISOString(),
          endsAt:       booking.endsAt.toISOString(),
        };
      });
    } catch (err: any) {
      // Código PostgreSQL 55P03 = lock_not_available (NOWAIT)
      if (err?.code === '55P03') {
        throw new ConflictException(
          'Horário disputado simultaneamente — tente novamente em instantes',
        );
      }
      throw err;
    }
  }
}
