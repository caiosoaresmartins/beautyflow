import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

export interface FindAllOptions {
  includeInactive?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(salonId: string, opts: FindAllOptions = {}) {
    const { includeInactive = false, page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const where: any = { salonId };
    if (!includeInactive) where.active = true;

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          durationMinutes: true,
          priceDefault: true,
          active: true,
          professionals: {
            select: {
              professional: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      data: data.map(s => ({
        ...s,
        priceDefault: Number(s.priceDefault),
        professionals: s.professionals.map(ps => ps.professional),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, salonId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, salonId },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        durationMinutes: true,
        priceDefault: true,
        active: true,
        createdAt: true,
        professionals: {
          select: {
            professional: { select: { id: true, name: true, email: true } },
          },
        },
        commissionRules: {
          select: { id: true, type: true, value: true },
        },
      },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado');
    return {
      ...service,
      priceDefault: Number(service.priceDefault),
      professionals: service.professionals.map(ps => ps.professional),
    };
  }

  async create(salonId: string, dto: CreateServiceDto) {
    const service = await this.prisma.service.create({
      data: { ...dto, salonId, active: dto.active ?? true },
      select: {
        id: true, name: true, category: true,
        durationMinutes: true, priceDefault: true, active: true,
      },
    });
    this.logger.log(`Serviço criado: id=${service.id} salonId=${salonId}`);
    return { ...service, priceDefault: Number(service.priceDefault) };
  }

  async update(id: string, salonId: string, dto: UpdateServiceDto) {
    await this.findOne(id, salonId);
    const updated = await this.prisma.service.update({
      where: { id },
      data: dto,
      select: {
        id: true, name: true, category: true,
        durationMinutes: true, priceDefault: true, active: true,
      },
    });
    return { ...updated, priceDefault: Number(updated.priceDefault) };
  }

  // Soft delete: marca active=false, preserva histórico de bookings
  async remove(id: string, salonId: string) {
    await this.findOne(id, salonId);
    await this.prisma.service.update({
      where: { id },
      data: { active: false },
    });
    this.logger.log(`Soft delete serviço id=${id} salonId=${salonId}`);
    return { message: 'Serviço desativado com sucesso', id };
  }

  // -----------------------------------------------------------
  // Vínculos Profissional <-> Serviço (ProfessionalService)
  // -----------------------------------------------------------

  async assignProfessional(serviceId: string, professionalId: string, salonId: string) {
    await this.findOne(serviceId, salonId);

    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, salonId },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado neste salão');

    const existing = await this.prisma.professionalService.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId } },
    });
    if (existing) throw new ConflictException('Profissional já vinculado a este serviço');

    await this.prisma.professionalService.create({
      data: { professionalId, serviceId },
    });
    return { message: 'Profissional vinculado ao serviço', professionalId, serviceId };
  }

  async removeProfessional(serviceId: string, professionalId: string, salonId: string) {
    await this.findOne(serviceId, salonId);
    await this.prisma.professionalService.deleteMany({
      where: { professionalId, serviceId },
    });
    return { message: 'Vínculo removido', professionalId, serviceId };
  }
}
