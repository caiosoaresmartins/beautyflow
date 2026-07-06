import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(salonId: string, dto: CreateBookingDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, salonId, active: true },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado ou inativo.');

    const professional = await this.prisma.professional.findFirst({
      where: { id: dto.professionalId, salonId },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado.');

    const startsAt = new Date(dto.startsAt);
    if (isNaN(startsAt.getTime())) throw new BadRequestException('Data inválida.');
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    // Criação atômica com verificação de conflito via transação
    return this.prisma.$transaction(async (tx) => {
      const conflicts = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM bookings
        WHERE "professionalId" = ${dto.professionalId}
          AND status != 'CANCELLED'
          AND "startsAt" < ${endsAt}
          AND "endsAt" > ${startsAt}
        FOR UPDATE NOWAIT
      `;

      if (conflicts.length > 0) {
        throw new ConflictException('Horário já ocupado para este profissional.');
      }

      return tx.booking.create({
        data: {
          salonId,
          professionalId: dto.professionalId,
          serviceId: dto.serviceId,
          clientId: dto.clientId,
          startsAt,
          endsAt,
          status: BookingStatus.PENDING,
          notes: dto.notes,
        },
        include: {
          service: { select: { id: true, name: true, durationMinutes: true, priceDefault: true } },
          client: { select: { id: true, name: true, whatsappId: true } },
          professional: { select: { id: true, name: true } },
        },
      });
    });
  }

  async findAll(salonId: string, pagination: PaginationDto, professionalId?: string, date?: string) {
    const where: Record<string, unknown> = { salonId, deletedAt: null };
    if (professionalId) where.professionalId = professionalId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.startsAt = { gte: start, lte: end };
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: pagination.limit,
        orderBy: { startsAt: 'asc' },
        include: {
          service: { select: { id: true, name: true, durationMinutes: true } },
          client: { select: { id: true, name: true } },
          professional: { select: { id: true, name: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return paginate(data, total, pagination);
  }

  async findOne(id: string, salonId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, salonId, deletedAt: null },
      include: {
        service: true,
        client: true,
        professional: true,
      },
    });
    if (!booking) throw new NotFoundException('Agendamento não encontrado.');
    return booking;
  }

  async updateStatus(id: string, salonId: string, status: BookingStatus) {
    await this.findOne(id, salonId);
    return this.prisma.booking.update({
      where: { id },
      data: { status },
    });
  }

  async remove(id: string, salonId: string) {
    await this.findOne(id, salonId);
    // Soft delete
    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED, deletedAt: new Date() },
    });
  }

  async getSchedule(professionalId: string, salonId: string, date: string) {
    await this.prisma.professional.findFirstOrThrow({
      where: { id: professionalId, salonId },
    });
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.prisma.booking.findMany({
      where: {
        professionalId,
        startsAt: { gte: start, lte: end },
        status: { not: BookingStatus.CANCELLED },
        deletedAt: null,
      },
      include: {
        service: { select: { id: true, name: true, durationMinutes: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }
}
