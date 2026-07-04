import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

@Injectable()
export class ProfessionalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(salonId: string) {
    return this.prisma.professional.findMany({
      where: { salonId },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
  }

  async findOne(id: string, salonId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id, salonId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        services: true,
      },
    });
    if (!professional) throw new NotFoundException('Professional not found');
    return professional;
  }

  async create(salonId: string, dto: CreateProfessionalDto) {
    return this.prisma.professional.create({
      data: { ...dto, salonId },
    });
  }

  async update(id: string, salonId: string, dto: UpdateProfessionalDto) {
    await this.findOne(id, salonId);
    return this.prisma.professional.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, salonId: string) {
    await this.findOne(id, salonId);
    return this.prisma.professional.delete({ where: { id } });
  }

  async getSchedule(professionalId: string, salonId: string, date: string) {
    await this.findOne(professionalId, salonId);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this.prisma.booking.findMany({
      where: {
        professionalId,
        scheduledAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      include: { service: true, client: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
