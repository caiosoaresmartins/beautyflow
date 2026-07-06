import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(salonId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: { ...dto, salonId } as any,
    });
  }

  async findAll(salonId: string, pagination: PaginationDto, onlyActive = true) {
    const where = { salonId, ...(onlyActive ? { active: true } : {}) };
    const skip = (pagination.page - 1) * pagination.limit;

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          priceDefault: true,
          category: true,
          active: true,
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return paginate(data, total, pagination);
  }

  async findOne(id: string, salonId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, salonId },
    });
    if (!service) throw new NotFoundException('Servico nao encontrado.');
    return service;
  }

  async update(id: string, salonId: string, dto: UpdateServiceDto) {
    await this.findOne(id, salonId);
    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, salonId: string) {
    await this.findOne(id, salonId);
    // Soft delete: desativa em vez de deletar (bookings futuras podem referenciar)
    return this.prisma.service.update({
      where: { id },
      data: { active: false },
    });
  }

  async assignProfessional(serviceId: string, professionalId: string, salonId: string) {
    await this.findOne(serviceId, salonId);
    return { serviceId, professionalId, assigned: true };
  }

  async removeProfessional(serviceId: string, professionalId: string, salonId: string) {
    await this.findOne(serviceId, salonId);
    return { serviceId, professionalId, removed: true };
  }
}
