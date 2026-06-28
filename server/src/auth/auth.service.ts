import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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

  /** Mint a staff token that lets an admin act as a restaurant. It is a normal
   *  staff token (so guards + ownership checks just work) plus impersonation
   *  claims for the banner + audit log. */
  async impersonationToken(restaurantId: string, admin: JwtPayload) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, isArchived: false },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const staff = await this.prisma.staff.findFirst({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
    });
    if (!staff) {
      throw new NotFoundException('Restaurant has no staff account to act as');
    }
    const payload: JwtPayload = {
      sub: staff.id,
      role: 'staff',
      restaurantId,
      email: staff.email,
      name: staff.name,
      impersonatedBy: admin.name,
      impersonatorId: admin.sub,
    };
    return {
      token: this.jwt.sign(payload, { expiresIn: '4h' }),
      restaurant: { id: restaurant.id, name: restaurant.name },
    };
  }

  /** Update the signed-in user's display name (staff or admin). */
  async updateProfile(payload: JwtPayload, name: string) {
    if (payload.role === 'admin') {
      await this.prisma.admin.update({ where: { id: payload.sub }, data: { name } });
    } else {
      await this.prisma.staff.update({ where: { id: payload.sub }, data: { name } });
    }
    return { ok: true, name };
  }

  /** Change the signed-in user's password after verifying the current one. */
  async changePassword(payload: JwtPayload, currentPassword: string, newPassword: string) {
    const record =
      payload.role === 'admin'
        ? await this.prisma.admin.findUnique({ where: { id: payload.sub } })
        : await this.prisma.staff.findUnique({ where: { id: payload.sub } });
    if (!record) throw new UnauthorizedException();
    if (!(await bcrypt.compare(currentPassword, record.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    if (payload.role === 'admin') {
      await this.prisma.admin.update({ where: { id: payload.sub }, data: { passwordHash } });
    } else {
      // Clear firstLogin too — a staff member who sets their own password is set up.
      await this.prisma.staff.update({
        where: { id: payload.sub },
        data: { passwordHash, firstLogin: false },
      });
    }
    return { ok: true };
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
      // Present only on impersonation sessions; drives the portal banner.
      impersonatedBy: payload.impersonatedBy ?? null,
    };
  }
}
