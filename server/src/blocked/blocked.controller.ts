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
import { CurrentUser, JwtAuthGuard, StaffGuard } from '../auth/guards';
import { JwtPayload } from '../auth/jwt.strategy';
import { BlockedService } from './blocked.service';
import { CreateBlockedDto, UpdateBlockedDto } from './dto';

@UseGuards(JwtAuthGuard, StaffGuard)
@Controller('blocked')
export class BlockedController {
  constructor(private blocked: BlockedService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.blocked.listForRestaurant(user.restaurantId!);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBlockedDto) {
    return this.blocked.create(user.restaurantId!, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBlockedDto,
  ) {
    return this.blocked.update(user.restaurantId!, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.blocked.archive(user.restaurantId!, id);
  }
}
