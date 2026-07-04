import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(salonId: string) {
    return this.prisma.client.findMany({
      where: { salonId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, salonId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, salonId },
      include: {
        bookings: {
          include: { service: true, professional: true },
          orderBy: { scheduledAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(salonId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: { ...dto, salonId },
    });
  }

  async update(id: string, salonId: string, dto: UpdateClientDto) {
    await this.findOne(id, salonId);
    return this.prisma.client.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, salonId: string) {
    await this.findOne(id, salonId);
    return this.prisma.client.delete({ where: { id } });
  }

  async search(salonId: string, query: string) {
    return this.prisma.client.findMany({
      where: {
        salonId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
    });
  }
}
