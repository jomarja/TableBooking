import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';
import { serializeRestaurant } from '../common/serializers';

// Include the relations the portal needs (tables/zones/floor plan/images/menu)
// so a freshly logged-in staff member has a complete restaurant object.
const restaurantInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  menu: { orderBy: { sortOrder: 'asc' as const } },
  zones: true,
  tables: true,
  floorPlanElements: true,
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async staffLogin(email: string, password: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { restaurant: { include: restaurantInclude } },
    });
    if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload: JwtPayload = {
      sub: staff.id,
      role: 'staff',
      restaurantId: staff.restaurantId,
      email: staff.email,
      name: staff.name,
    };
    return {
      token: this.jwt.sign(payload),
      staff: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        restaurantId: staff.restaurantId,
        firstLogin: staff.firstLogin,
      },
      restaurant: serializeRestaurant(staff.restaurant),
      firstLogin: staff.firstLogin,
    };
  }

  async adminLogin(email: string, password: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload: JwtPayload = {
      sub: admin.id,
      role: 'admin',
      email: admin.email,
      name: admin.name,
    };
    return {
      token: this.jwt.sign(payload),
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  async me(payload: JwtPayload) {
    if (payload.role === 'admin') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      });
      if (!admin) throw new UnauthorizedException();
      return {
        role: 'admin',
        admin: { id: admin.id, email: admin.email, name: admin.name },
      };
    }
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      include: { restaurant: { include: restaurantInclude } },
    });
    if (!staff) throw new UnauthorizedException();
    return {
      role: 'staff',
      staff: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        restaurantId: staff.restaurantId,
        firstLogin: staff.firstLogin,
      },
      restaurant: serializeRestaurant(staff.restaurant),
    };
  }
}
