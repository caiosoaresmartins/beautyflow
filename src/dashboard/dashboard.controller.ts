import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salons/:salonId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard stats for a salon' })
  getStats(@Param('salonId') salonId: string) {
    return this.dashboardService.getStats(salonId);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue stats for current month' })
  getRevenueStats(@Param('salonId') salonId: string) {
    return this.dashboardService.getRevenueStats(salonId);
  }
}
