import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ProfessionalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(salonId: string) {
    return this.prisma.professional.findMany({
      where: { salonId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string, salonId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id, salonId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        role: true,
        createdAt: true,
        workingHours: true,
        commissionRules: true,
      },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado');
    return professional;
  }

  async create(salonId: string, dto: CreateProfessionalDto) {
    const existing = await this.prisma.professional.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const { password, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 12);

    return this.prisma.professional.create({
      data: { ...rest, passwordHash, salonId },
      select: { id: true, name: true, email: true, phone: true, bio: true, role: true, createdAt: true },
    });
  }

  async update(id: string, salonId: string, dto: UpdateProfessionalDto) {
    await this.findOne(id, salonId);
    return this.prisma.professional.update({
      where: { id },
      data: dto,
      select: { id: true, name: true, email: true, phone: true, bio: true, role: true },
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
        startsAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      include: { service: true, client: true },
      orderBy: { startsAt: 'asc' },
    });
  }
}
