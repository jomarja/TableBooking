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
import { CurrentUser, JwtAuthGuard, StaffGuard } from '../auth/guards';
import { JwtPayload } from '../auth/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import {
  CreateCustomerReservationDto,
  CreateStaffReservationDto,
  UpdateReservationDto,
} from './dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(
    private reservations: ReservationsService,
    private audit: AuditService,
  ) {}

  /** Public customer booking. */
  @Post()
  create(@Body() dto: CreateCustomerReservationDto) {
    return this.reservations.createCustomer(dto);
  }

  /** Portal: list reservations for the staff's restaurant. */
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    return this.reservations.listForRestaurant(user.restaurantId!, date);
  }

  /** Portal: a customer's profile + reservation history (by phone). */
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('customer')
  customer(@CurrentUser() user: JwtPayload, @Query('phone') phone: string) {
    return this.reservations.customerProfile(user.restaurantId!, phone);
  }

  /** Portal: save CRM details (email, birthday, tags…) for a customer. */
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put('customer')
  async saveCustomer(
    @CurrentUser() user: JwtPayload,
    @Query('phone') phone: string,
    @Body() body: { email?: string; birthday?: string; company?: string; address?: string; tags?: string[]; notes?: string },
    @Req() req: Request,
  ) {
    const meta = await this.reservations.saveCustomerMeta(user.restaurantId!, phone, body);
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Customer Updated',
      restaurantId: user.restaurantId,
      target: phone,
    });
    return meta;
  }

  /** Portal: manual reservation. */
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('manual')
  async createManual(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStaffReservationDto,
    @Req() req: Request,
  ) {
    const res = await this.reservations.createByStaff(
      user.restaurantId!,
      dto,
      'STAFF',
    );
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Reservation Created',
      restaurantId: user.restaurantId,
      target: `Reservation #${(res as any)?.id ?? ''}`,
      newValue: `${dto.name ?? ''} · ${dto.guests ?? ''} guests · ${dto.date ?? ''} ${dto.startTime ?? ''}`.trim(),
    });
    return res;
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @Req() req: Request,
  ) {
    const actorName = user.impersonatedBy ? `${user.impersonatedBy} (admin)` : user.name;
    const result = await this.reservations.update(
      user.restaurantId!,
      id,
      dto,
      actorName,
    );
    const action =
      dto.status === 'CANCELLED'
        ? 'Reservation Cancelled'
        : dto.status === 'CONFIRMED'
          ? 'Reservation Confirmed'
          : 'Reservation Edited';
    await this.audit.log({
      user,
      ip: req.ip,
      action,
      restaurantId: user.restaurantId,
      target: `Reservation #${id}`,
      newValue: (result as any)?.summary || (result as any)?.actions?.join('; ') || null,
    });
    return result;
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const actorName = user.impersonatedBy ? `${user.impersonatedBy} (admin)` : user.name;
    const result = await this.reservations.archive(
      user.restaurantId!,
      id,
      actorName,
    );
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Reservation Deleted',
      restaurantId: user.restaurantId,
      target: `Reservation #${id}`,
    });
    return result;
  }
}
