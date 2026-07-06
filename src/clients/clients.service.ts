import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(salonId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: { ...dto, salonId },
    });
  }

  async findAll(salonId: string, pagination: PaginationDto, search?: string) {
    const where: Record<string, unknown> = { salonId, deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { whatsappId: { contains: search } },
      ];
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          whatsappId: true,
          cpf: true,
          optedOut: true,
          createdAt: true,
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return paginate(data, total, pagination);
  }

  async findOne(id: string, salonId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, salonId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    return client;
  }

  async findByWhatsapp(whatsappId: string, salonId: string) {
    return this.prisma.client.findFirst({
      where: { whatsappId, salonId, deletedAt: null },
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
    // Soft delete — LGPD: mantém histórico mas marca como deletado
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async optOut(id: string, salonId: string) {
    await this.findOne(id, salonId);
    return this.prisma.client.update({
      where: { id },
      data: { optedOut: true, optedOutAt: new Date() },
    });
  }

  /** LGPD: anonimiza dados pessoais do cliente */
  async anonymize(id: string, salonId: string) {
    await this.findOne(id, salonId);
    return this.prisma.client.update({
      where: { id },
      data: {
        name: 'ANONIMIZADO',
        email: null,
        phone: null,
        cpf: null,
        whatsappId: `anon_${id}`,
        optedOut: true,
        optedOutAt: new Date(),
        deletedAt: new Date(),
      },
    });
  }
}
