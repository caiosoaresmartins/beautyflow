import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SalonsModule } from './salons/salons.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { ServicesModule } from './services/services.module';
import { ClientsModule } from './clients/clients.module';
import { BookingsModule } from './bookings/bookings.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    // ── Configuração global de env ──────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ── Rate limiting global ────────────────────────────────
    // Configurável via env: THROTTLE_TTL (ms) e THROTTLE_LIMIT (req)
    ThrottlerModule.forRootAsync({
      useFactory: () => ([
        {
          ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
          limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
        },
      ]),
    }),

    PrismaModule,
    AuthModule,
    SalonsModule,
    ProfessionalsModule,
    ServicesModule,
    ClientsModule,
    BookingsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    // ThrottlerGuard aplicado globalmente a TODOS os endpoints
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
