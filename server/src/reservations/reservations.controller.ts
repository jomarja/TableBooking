import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, StaffGuard } from '../auth/guards';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  CreateCustomerReservationDto,
  CreateStaffReservationDto,
  UpdateReservationDto,
} from './dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private reservations: ReservationsService) {}

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

  /** Portal: manual reservation. */
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('manual')
  createManual(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStaffReservationDto,
  ) {
    return this.reservations.createByStaff(user.restaurantId!, dto, 'STAFF');
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservations.update(user.restaurantId!, id, dto, user.email);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reservations.archive(user.restaurantId!, id, user.email);
  }
}
