import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, JwtAuthGuard, StaffGuard } from '../auth/guards';
import { JwtPayload } from '../auth/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { BlockedService } from './blocked.service';
import { CreateBlockedDto, UpdateBlockedDto } from './dto';

@UseGuards(JwtAuthGuard, StaffGuard)
@Controller('blocked')
export class BlockedController {
  constructor(
    private blocked: BlockedService,
    private audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.blocked.listForRestaurant(user.restaurantId!);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBlockedDto,
    @Req() req: Request,
  ) {
    const res = await this.blocked.create(user.restaurantId!, dto);
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Blocked Period Created',
      restaurantId: user.restaurantId,
      target: dto.reason || 'Blocked period',
      newValue: `${dto.date ?? dto.type ?? ''} ${dto.startTime ?? ''}–${dto.endTime ?? ''}`.trim(),
    });
    return res;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBlockedDto,
    @Req() req: Request,
  ) {
    const res = await this.blocked.update(user.restaurantId!, id, dto);
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Blocked Period Changed',
      restaurantId: user.restaurantId,
      target: dto.reason || `Blocked period #${id}`,
    });
    return res;
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const res = await this.blocked.archive(user.restaurantId!, id);
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Blocked Period Deleted',
      restaurantId: user.restaurantId,
      target: `Blocked period #${id}`,
    });
    return res;
  }
}
