import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    // ─── Config global ────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ─── Agendador de tarefas (cron jobs) ─────────────────────────
    ScheduleModule.forRoot(),

    // ─── Rate limiting global ──────────────────────────────────────
    ThrottlerModule.forRootAsync({
      useFactory: () => ([
        {
          ttl:   parseInt(process.env.THROTTLE_TTL   ?? '60000', 10),
          limit: parseInt(process.env.THROTTLE_LIMIT ?? '100',   10),
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
    NotificationsModule,
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
