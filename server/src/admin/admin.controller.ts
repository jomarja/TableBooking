import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard, CurrentUser, JwtAuthGuard } from '../auth/guards';
import { JwtPayload } from '../auth/jwt.strategy';
import { AdminService } from './admin.service';
import {
  AdminUpdateRestaurantDto,
  CreateRestaurantDto,
  ResetPasswordDto,
  SetStatusDto,
} from './dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('restaurants')
  list() {
    return this.admin.listRestaurants();
  }

  @Post('restaurants')
  create(
    @Body() dto: CreateRestaurantDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.admin.createRestaurant(dto, { user, ip: req.ip });
  }

  @Patch('restaurants/:id')
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.admin.setStatus(id, dto.status, { user, ip: req.ip });
  }

  @Put('restaurants/:id')
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateRestaurantDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.admin.updateRestaurant(id, dto, { user, ip: req.ip });
  }

  /** "Login as Restaurant" — returns a short-lived staff token for the portal. */
  @Post('restaurants/:id/impersonate')
  impersonate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.admin.impersonate(id, { user, ip: req.ip });
  }

  @Post('restaurants/:id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.admin.resetPassword(id, dto.password, { user, ip: req.ip });
  }

  @Delete('restaurants/:id')
  archive(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.admin.archiveRestaurant(id, { user, ip: req.ip });
  }

  @Get('audit-logs')
  auditLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('restaurantId') restaurantId?: string,
    @Query('user') user?: string,
    @Query('action') action?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.auditLogs({ from, to, restaurantId, user, action, role, search });
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }
}
