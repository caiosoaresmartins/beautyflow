import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterProfessionalDto } from './dto/register-professional.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateProfessional(email: string, password: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { email },
      include: { salon: true },
    });
    if (!professional) throw new UnauthorizedException('Credenciais invalidas');
    const valid = await bcrypt.compare(password, professional.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais invalidas');
    return professional;
  }

  async login(loginDto: LoginDto) {
    const professional = await this.validateProfessional(loginDto.email, loginDto.password);
    const payload = {
      sub: professional.id,
      salonId: professional.salonId,
      role: professional.role,
      email: professional.email,
    };
    return {
      access_token: this.jwtService.sign(payload),
      professional: {
        id: professional.id,
        name: professional.name,
        email: professional.email,
        role: professional.role,
        salonId: professional.salonId,
        salonName: professional.salon.name,
      },
    };
  }

  async register(dto: RegisterProfessionalDto) {
    const exists = await this.prisma.professional.findFirst({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email ja cadastrado');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const professional = await this.prisma.professional.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role || 'OWNER',
        salonId: dto.salonId,
      },
    });
    const payload = { sub: professional.id, salonId: professional.salonId, role: professional.role };
    return { access_token: this.jwtService.sign(payload) };
  }

  async getProfile(professionalId: string) {
    return this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: { salon: true },
      omit: { passwordHash: true } as any,
    });
  }
}
