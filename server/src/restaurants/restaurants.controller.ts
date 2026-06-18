import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
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
  ) {}

  // ---- Public reads ----
  @Get()
  findAll() {
    return this.restaurants.findAllPublic();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.restaurants.findOnePublic(id);
  }

  @Get(':id/availability')
  getAvailability(@Param('id') id: string, @Query('date') date: string) {
    return this.availability.getAvailability(id, date);
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
  ) {
    return this.restaurants.update(id, user.restaurantId, dto);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id/zones')
  setZones(
    @Param('id') id: string,
    @Body() dto: SetZonesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurants.setZones(id, user.restaurantId, dto.zones);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id/tables')
  setTables(
    @Param('id') id: string,
    @Body() dto: SetTablesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurants.setTables(id, user.restaurantId, dto.tables);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id/floorplan')
  setFloorPlan(
    @Param('id') id: string,
    @Body() dto: SetFloorPlanDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurants.setFloorPlan(id, user.restaurantId, {
      elements: dto.elements,
      background: dto.background,
    });
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
