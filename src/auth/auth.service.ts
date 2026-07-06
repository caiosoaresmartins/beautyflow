import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterProfessionalDto } from './dto/register-professional.dto';
import { ProfessionalRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------

  private buildTokens(payload: { sub: string; salonId: string; role: ProfessionalRole; email: string }) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: this.config.get<string>('JWT_SECRET'),
    });
    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, type: 'refresh' },
      {
        expiresIn: '30d',
        secret: this.config.get<string>('JWT_REFRESH_SECRET', this.config.get<string>('JWT_SECRET') + '_refresh'),
      },
    );
    return { accessToken, refreshToken };
  }

  // -----------------------------------------------------------
  // validateProfessional (usada pelo LocalStrategy e login)
  // -----------------------------------------------------------

  async validateProfessional(email: string, password: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { email },
      include: { salon: true },
    });
    if (!professional) throw new UnauthorizedException('Credenciais inválidas');
    const valid = await bcrypt.compare(password, professional.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');
    return professional;
  }

  // -----------------------------------------------------------
  // login — retorna accessToken (15 min) + refreshToken (30 dias)
  // -----------------------------------------------------------

  async login(loginDto: LoginDto) {
    const professional = await this.validateProfessional(loginDto.email, loginDto.password);
    const payload = {
      sub: professional.id,
      salonId: professional.salonId,
      role: professional.role,
      email: professional.email,
    };
    const tokens = this.buildTokens(payload);
    this.logger.log(`Login: professional=${professional.id} role=${professional.role}`);
    return {
      ...tokens,
      professional: {
        id: professional.id,
        name: professional.name,
        email: professional.email,
        role: professional.role,
        salonId: professional.salonId,
        salonName: professional.salon?.name ?? null,
      },
    };
  }

  // -----------------------------------------------------------
  // register — cria Salon automaticamente para OWNER
  // -----------------------------------------------------------

  async register(dto: RegisterProfessionalDto) {
    const exists = await this.prisma.professional.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const role = dto.role ?? ProfessionalRole.OWNER;
    let salonId = dto.salonId;

    if (role === ProfessionalRole.OWNER) {
      if (!dto.salonName) throw new BadRequestException('salonName é obrigatório para role OWNER');
      const salon = await this.prisma.salon.create({
        data: { name: dto.salonName },
      });
      salonId = salon.id;
    } else {
      if (!salonId) throw new BadRequestException('salonId é obrigatório para roles não-OWNER');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const professional = await this.prisma.professional.create({
      data: { name: dto.name, email: dto.email, passwordHash, role, salonId },
      select: { id: true, name: true, email: true, role: true, salonId: true },
    });

    const payload = {
      sub: professional.id,
      salonId: professional.salonId,
      role: professional.role,
      email: professional.email,
    };
    const tokens = this.buildTokens(payload);
    this.logger.log(`Register: professional=${professional.id} salonId=${salonId} role=${role}`);
    return { ...tokens, professional };
  }

  // -----------------------------------------------------------
  // refresh — valida refreshToken e emite novo par de tokens
  // -----------------------------------------------------------

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET', this.config.get<string>('JWT_SECRET') + '_refresh'),
      });
      if (payload.type !== 'refresh') throw new UnauthorizedException('Token inválido');

      const professional = await this.prisma.professional.findUnique({
        where: { id: payload.sub },
        select: { id: true, salonId: true, role: true, email: true },
      });
      if (!professional) throw new UnauthorizedException('Profissional não encontrado');

      const newPayload = {
        sub: professional.id,
        salonId: professional.salonId,
        role: professional.role,
        email: professional.email,
      };
      return this.buildTokens(newPayload);
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  // -----------------------------------------------------------
  // getProfile — select explícito, nunca retorna passwordHash
  // -----------------------------------------------------------

  async getProfile(professionalId: string) {
    return this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        role: true,
        salonId: true,
        createdAt: true,
        salon: { select: { id: true, name: true } },
      },
    });
  }
}
