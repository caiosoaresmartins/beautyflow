import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ProfessionalsService {
  constructor(private prisma: PrismaService) {}

  async create(salonId: string, dto: CreateProfessionalDto) {
    const existing = await this.prisma.professional.findFirst({
      where: { email: dto.email, salonId },
    });
    if (existing) throw new ConflictException('Email já cadastrado neste salão.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.professional.create({
      data: {
        salonId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        phone: dto.phone,
        bio: dto.bio,
        role: dto.role,
      },
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

  async findAll(salonId: string, pagination: PaginationDto) {
    const skip = (pagination.page - 1) * pagination.limit;
    const [data, total] = await Promise.all([
      this.prisma.professional.findMany({
        where: { salonId },
        skip,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          bio: true,
          createdAt: true,
          workingHours: true,
        },
      }),
      this.prisma.professional.count({ where: { salonId } }),
    ]);
    return paginate(data, total, pagination);
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
        leaveBlocks: true,
        commissionRules: true,
      },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado.');
    return professional;
  }

  async update(id: string, salonId: string, dto: UpdateProfessionalDto) {
    await this.findOne(id, salonId);
    const data: Record<string, unknown> = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
      delete data.password;
    }
    return this.prisma.professional.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        role: true,
      },
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
