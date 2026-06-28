import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { ChangePasswordDto, LoginDto, UpdateProfileDto } from './dto';
import { CurrentUser, JwtAuthGuard } from './guards';
import { JwtPayload } from './jwt.strategy';

@Controller()
export class AuthController {
  constructor(
    private auth: AuthService,
    private audit: AuditService,
  ) {}

  @Post('auth/login')
  staffLogin(@Body() dto: LoginDto) {
    return this.auth.staffLogin(dto.email, dto.password);
  }

  @Post('admin/login')
  adminLogin(@Body() dto: LoginDto) {
    return this.auth.adminLogin(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/me')
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user);
  }

  /** Update own display name. */
  @UseGuards(JwtAuthGuard)
  @Patch('auth/profile')
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user, dto.name ?? user.name);
  }

  /** Change own password (verifies the current one). */
  @UseGuards(JwtAuthGuard)
  @Post('auth/change-password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const res = await this.auth.changePassword(user, dto.currentPassword, dto.newPassword);
    await this.audit.log({
      user,
      ip: req.ip,
      action: 'Password Changed',
      restaurantId: user.restaurantId,
      target: user.email,
    });
    return res;
  }

  /** Called by the portal when an admin exits impersonation. */
  @UseGuards(JwtAuthGuard)
  @Post('auth/impersonation/end')
  async endImpersonation(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    if (user.impersonatedBy) {
      await this.audit.log({
        user,
        ip: req.ip,
        action: 'Impersonation Ended',
        restaurantId: user.restaurantId,
      });
    }
    return { ok: true };
  }
}
