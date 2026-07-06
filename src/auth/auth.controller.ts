import { Controller, Post, Get, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterProfessionalDto } from './dto/register-professional.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login — retorna accessToken (15 min) + refreshToken (30 dias)' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar novo profissional (OWNER cria Salão automaticamente)' })
  register(@Body() dto: RegisterProfessionalDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar accessToken usando refreshToken' })
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } }, required: ['refreshToken'] } })
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna perfil do profissional logado (sem passwordHash)' })
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.sub);
  }
}
