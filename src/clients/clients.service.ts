import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(salonId: string) {
    return this.prisma.client.findMany({
      where: { salonId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, salonId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, salonId, deletedAt: null },
      include: {
        bookings: {
          include: { service: true, professional: { select: { id: true, name: true } } },
          orderBy: { startsAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    return client;
  }

  async create(salonId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: { ...dto, salonId },
    });
  }

  async update(id: string, salonId: string, dto: UpdateClientDto) {
    await this.findOne(id, salonId);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  // Soft delete: preserva histórico de agendamentos (LGPD-safe)
  async remove(id: string, salonId: string) {
    await this.findOne(id, salonId);
    this.logger.log(`Soft delete cliente id=${id} salonId=${salonId}`);
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async search(salonId: string, query: string) {
    return this.prisma.client.findMany({
      where: {
        salonId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }
}
