import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(
    salonId: string,
    filters?: { date?: string; professionalId?: string; status?: string },
  ) {
    const where: any = { salonId };
    if (filters?.professionalId) where.professionalId = filters.professionalId;
    if (filters?.status) where.status = filters.status;
    if (filters?.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      where.startsAt = { gte: start, lte: end };
    }
    return this.prisma.booking.findMany({
      where,
      include: {
        client: true,
        professional: { select: { id: true, name: true, email: true } },
        service: true,
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async findOne(id: string, salonId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, salonId },
      include: {
        client: true,
        professional: { select: { id: true, name: true, email: true } },
        service: true,
      },
    });
    if (!booking) throw new NotFoundException('Agendamento não encontrado');
    return booking;
  }

  async create(salonId: string, dto: CreateBookingDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, salonId, active: true },
    });
    if (!service) throw new BadRequestException('Serviço não encontrado neste salão');

    const professional = await this.prisma.professional.findFirst({
      where: { id: dto.professionalId, salonId },
    });
    if (!professional) throw new BadRequestException('Profissional não encontrado neste salão');

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    // Verificação de conflito
    const conflict = await this.prisma.booking.findFirst({
      where: {
        professionalId: dto.professionalId,
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (conflict) {
      throw new BadRequestException('Profissional já possui agendamento neste horário');
    }

    this.logger.log(`Criando booking: professional=${dto.professionalId} startsAt=${startsAt.toISOString()}`);

    return this.prisma.booking.create({
      data: {
        salonId,
        clientId: dto.clientId,
        professionalId: dto.professionalId,
        serviceId: dto.serviceId,
        subscriptionId: dto.subscriptionId,
        startsAt,
        endsAt,
        status: BookingStatus.CONFIRMED,
      },
      include: {
        client: true,
        service: true,
        professional: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateStatus(id: string, salonId: string, status: BookingStatus) {
    await this.findOne(id, salonId);
    const data: any = { status };
    if (status === BookingStatus.CANCELLED) {
      data.cancelledAt = new Date();
    }
    return this.prisma.booking.update({ where: { id }, data });
  }

  async update(id: string, salonId: string, dto: UpdateBookingDto) {
    await this.findOne(id, salonId);
    return this.prisma.booking.update({ where: { id }, data: dto });
  }

  // Soft cancel em vez de delete físico (preserva histórico)
  async remove(id: string, salonId: string) {
    await this.findOne(id, salonId);
    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
    });
  }
}
