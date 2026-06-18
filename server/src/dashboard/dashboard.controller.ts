import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, StaffGuard } from '../auth/guards';
import { JwtPayload } from '../auth/jwt.strategy';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, StaffGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    return this.dashboard.summary(user.restaurantId!, date);
  }
}
