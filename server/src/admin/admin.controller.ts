import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard, JwtAuthGuard } from '../auth/guards';
import { AdminService } from './admin.service';
import { CreateRestaurantDto, ResetPasswordDto, SetStatusDto } from './dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('restaurants')
  list() {
    return this.admin.listRestaurants();
  }

  @Post('restaurants')
  create(@Body() dto: CreateRestaurantDto) {
    return this.admin.createRestaurant(dto);
  }

  @Patch('restaurants/:id')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.admin.setStatus(id, dto.status);
  }

  @Post('restaurants/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.admin.resetPassword(id, dto.password);
  }

  @Delete('restaurants/:id')
  archive(@Param('id') id: string) {
    return this.admin.archiveRestaurant(id);
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }
}
