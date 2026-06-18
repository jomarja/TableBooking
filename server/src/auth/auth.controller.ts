import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';
import { CurrentUser, JwtAuthGuard } from './guards';
import { JwtPayload } from './jwt.strategy';

@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}

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
}
