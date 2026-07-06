import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsNumber, IsPositive, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';

export class CreatePlanDto {
  @ApiProperty({ example: 'Clube da Barba Mensal' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Corte + barba ilimitados por mês', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 89.90 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ example: 4, description: 'Agendamentos incluídos por mês' })
  @IsInt()
  @Min(1)
  bookingsPerMonth: number;
}

export class UpdatePlanDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  bookingsPerMonth?: number;
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(salonId: string, dto: CreatePlanDto) {
    const exists = await this.prisma.plan.findFirst({
      where: { salonId, name: dto.name, active: true },
    });
    if (exists) throw new ConflictException(`Já existe um plano ativo com o nome "${dto.name}"`);

    return this.prisma.plan.create({
      data: {
        salonId,
        name: dto.name,
        description: dto.description,
        price: new Decimal(dto.price),
        bookingsPerMonth: dto.bookingsPerMonth,
        active: true,
      },
    });
  }

  async findAll(salonId: string, onlyActive = false) {
    return this.prisma.plan.findMany({
      where: { salonId, ...(onlyActive ? { active: true } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        bookingsPerMonth: true,
        active: true,
        createdAt: true,
        _count: { select: { subscriptions: true } },
      },
    });
  }

  async findOne(id: string, salonId: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id, salonId },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async update(id: string, salonId: string, dto: UpdatePlanDto) {
    await this.findOne(id, salonId);
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: new Decimal(dto.price) }),
        ...(dto.bookingsPerMonth !== undefined && { bookingsPerMonth: dto.bookingsPerMonth }),
      },
    });
  }

  async deactivate(id: string, salonId: string) {
    await this.findOne(id, salonId);
    // Verificar assinaturas ativas antes de desativar
    const activeSubs = await this.prisma.subscription.count({
      where: { planId: id, status: { in: ['ACTIVE', 'PENDING', 'PAST_DUE'] } },
    });
    return this.prisma.plan.update({
      where: { id },
      data: { active: false },
    });
  }
}
