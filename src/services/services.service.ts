import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId },
      include: { professionals: { include: { user: { select: { name: true } } } } },
    });
  }

  async findOne(id: string, salonId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, salonId },
      include: { professionals: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(salonId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: { ...dto, salonId },
    });
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
    return this.prisma.service.delete({ where: { id } });
  }
}
