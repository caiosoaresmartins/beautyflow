import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { SalonsModule } from './salons/salons.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { ServicesModule } from './services/services.module';
import { ClientsModule } from './clients/clients.module';
import { BookingsModule } from './bookings/bookings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { AiOrchestratorModule } from './ai-orchestrator/ai-orchestrator.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AvailabilityModule } from './common/availability/availability.module';

@Module({
  imports: [
    // Infra
    PrismaModule,
    RedisModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Domínio
    AuthModule,
    SalonsModule,
    ProfessionalsModule,
    ServicesModule,
    ClientsModule,
    BookingsModule,
    DashboardModule,
    AvailabilityModule,

    // Canais e IA
    WhatsAppModule,
    AiOrchestratorModule,
    NotificationsModule,

    // Financeiro
    BillingModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
