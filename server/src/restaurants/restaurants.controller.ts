import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AvailabilityService } from '../availability/availability.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, JwtAuthGuard, StaffGuard } from '../auth/guards';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  SetFloorPlanDto,
  SetTablesDto,
  SetZonesDto,
  UpdateRestaurantDto,
} from './dto';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private restaurants: RestaurantsService,
    private availability: AvailabilityService,
    private audit: AuditService,
  ) {}

  // ---- Public reads ----
  @Get()
  findAll() {
    return this.restaurants.findAllPublic();
  }

  /** Per-restaurant availability status for a date (list filter + badges).
   *  Declared before :id so the literal path wins the route match. */
  @Get('availability-summary')
  availabilitySummary(@Query('date') date: string) {
    return this.availability.summarizeForDate(date);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.restaurants.findOnePublic(id);
  }

  @Get(':id/availability')
  getAvailability(@Param('id') id: string, @Query('date') date: string) {
    return this.availability.getAvailability(id, date);
  }

  /** Day-by-day status across a range (calendar colouring). */
  @Get(':id/availability-calendar')
  availabilityCalendar(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.availability.calendarFor(id, from, to);
  }

  /** First upcoming bookable date (for "Next available day"). */
  @Get(':id/next-availability')
  nextAvailability(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('guests') guests?: string,
  ) {
    return this.availability.nextAvailability(id, from, guests ? Number(guests) : undefined);
  }

  @Get(':id/reservation-config')
  reservationConfig(@Param('id') id: string) {
    return this.restaurants.reservationConfig(id);
  }

  // ---- Staff (portal) reads/writes ----
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get(':id/manage')
  manage(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // Staff may only read their own restaurant via this route.
    if (user.restaurantId !== id) {
      return this.restaurants.findOnePublic(id);
    }
    return this.restaurants.findOneForStaff(id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.restaurants.update(id, user.restaurantId, dto, {
      user,
      ip: req.ip,
    });
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id/zones')
  async setZones(
    @Param('id') id: string,
    @Body() dto: SetZonesDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const result = await this.restaurants.setZones(id, user.restaurantId, dto.zones);
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Zones Changed',
      restaurantId: user.restaurantId,
      newValue: dto.zones.map((z) => z.name).join(', '),
    });
    return result;
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id/tables')
  setTables(
    @Param('id') id: string,
    @Body() dto: SetTablesDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.restaurants.setTables(id, user.restaurantId, dto.tables, {
      user,
      ip: req.ip,
    });
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id/floorplan')
  async setFloorPlan(
    @Param('id') id: string,
    @Body() dto: SetFloorPlanDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const result = await this.restaurants.setFloorPlan(id, user.restaurantId, {
      elements: dto.elements,
      background: dto.background,
    });
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Floor Plan Changed',
      restaurantId: user.restaurantId,
      newValue: `${dto.elements?.length ?? 0} elements`,
    });
    return result;
  }

  // ---- Images ----
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post(':id/images')
  addImage(
    @Param('id') id: string,
    @Body() body: { url: string; type?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurants.addImage(id, user.restaurantId, body.url, body.type);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Delete(':id/images/:imageId')
  deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurants.deleteImage(id, user.restaurantId, imageId);
  }

  // ---- Menu ----
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post(':id/menu')
  addMenuItem(
    @Param('id') id: string,
    @Body() body: { category?: string; name: string; description?: string; price?: string; photo?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurants.addMenuItem(id, user.restaurantId, body);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id/menu/:itemId')
  updateMenuItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { category?: string; name?: string; description?: string; price?: string; photo?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurants.updateMenuItem(id, user.restaurantId, itemId, body);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Delete(':id/menu/:itemId')
  deleteMenuItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurants.deleteMenuItem(id, user.restaurantId, itemId);
  }
}
