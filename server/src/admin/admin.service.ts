import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { serializeRestaurant } from '../common/serializers';
import { AuthService } from '../auth/auth.service';
import { AuditService, type AuditActor, type AuditQuery } from '../audit/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private audit: AuditService,
  ) {}

  /** All restaurants (any status) for the admin console. */
  async listRestaurants() {
    const rows = await this.prisma.restaurant.findMany({
      where: { isArchived: false },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        staff: true,
        _count: { select: { reservations: true, tables: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      ...serializeRestaurant(r),
      staff: r.staff.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        firstLogin: s.firstLogin,
      })),
      reservationCount: r._count.reservations,
      tableCount: r._count.tables,
    }));
  }

  /** Create a restaurant + its staff account. */
  async createRestaurant(dto: any, actor?: AuditActor) {
    const existing = await this.prisma.staff.findUnique({
      where: { email: dto.ownerEmail.toLowerCase().trim() },
    });
    if (existing) {
      throw new BadRequestException('A staff account with this email exists');
    }

    const passwordHash = await bcrypt.hash(dto.ownerPassword || 'password', 10);

    const restaurant = await this.prisma.restaurant.create({
      data: {
        name: dto.name || 'New Restaurant',
        cuisine: dto.cuisine || 'georgian',
        address: dto.address || '',
        website: dto.website || '',
        phone: dto.phone || '',
        rating: dto.rating ?? 0,
        priceRange: dto.priceRange || '',
        openingTime: '10:00',
        kitchenClosing: '22:00',
        closingTime: '23:00',
        status: 'PENDING',
        published: false,
        reservationRules: {
          defaultDurationMinutes: 120,
          durationByGuests: [
            { maxGuests: 2, minutes: 90 },
            { maxGuests: 4, minutes: 120 },
            { maxGuests: 8, minutes: 180 },
          ],
        },
        reservationConfirmationPolicy: { autoConfirm: true },
        capacityRules: {
          maxGuestsPerReservation: 20,
          maxReservationsPerTimeSlot: 15,
        },
        holidayClosures: [],
        staff: {
          create: {
            email: dto.ownerEmail.toLowerCase().trim(),
            name: dto.ownerName || 'Owner',
            passwordHash,
            firstLogin: true,
          },
        },
      },
      include: { staff: true },
    });

    if (actor) {
      await this.audit.log({
        user: actor.user,
        ip: actor.ip,
        action: 'Restaurant Created',
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        target: restaurant.name,
        newValue: `Owner: ${restaurant.staff[0]?.email ?? ''}`,
      });
    }

    return {
      restaurant: serializeRestaurant(restaurant),
      staff: restaurant.staff.map((s) => ({ id: s.id, email: s.email })),
    };
  }

  /** Mint an impersonation token for "Login as Restaurant" + log it. */
  async impersonate(id: string, actor: AuditActor) {
    const res = await this.auth.impersonationToken(id, actor.user);
    await this.audit.log({
      user: actor.user,
      ip: actor.ip,
      action: 'Impersonation Started',
      restaurantId: res.restaurant.id,
      restaurantName: res.restaurant.name,
    });
    return res;
  }

  /** Audit log query for the admin console. */
  auditLogs(query: AuditQuery) {
    return this.audit.query(query);
  }

  /** Admin edit of any core restaurant field (rating, name, profile, etc.). */
  async updateRestaurant(id: string, dto: any, actor?: AuditActor) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id, isArchived: false },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    const fields = [
      'name',
      'cuisine',
      'address',
      'website',
      'phone',
      'rating',
      'reviewCount',
      'priceRange',
      'priceLevel',
      'published',
      'outdoorSeating',
      'familyFriendly',
      'description',
    ];
    const data: any = {};
    const changed: string[] = [];
    for (const f of fields) {
      if (dto[f] !== undefined && dto[f] !== (r as any)[f]) {
        data[f] = dto[f];
        changed.push(f);
      }
    }
    await this.prisma.restaurant.update({ where: { id }, data });
    if (actor && changed.length) {
      const ratingChanged = changed.includes('rating');
      await this.audit.log({
        user: actor.user,
        ip: actor.ip,
        action: ratingChanged ? 'Changed Rating' : 'Restaurant Settings Changed',
        restaurantId: id,
        restaurantName: r.name,
        target: changed.join(', '),
        oldValue: ratingChanged ? `${(r as any).rating}` : null,
        newValue: ratingChanged ? `${dto.rating}` : changed.join(', '),
      });
    }
    return { ok: true };
  }

  async setStatus(
    id: string,
    status: 'PENDING' | 'APPROVED' | 'DISABLED',
    actor?: AuditActor,
  ) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id, isArchived: false },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    await this.prisma.restaurant.update({ where: { id }, data: { status } });
    if (actor && r.status !== status) {
      const action =
        status === 'DISABLED'
          ? 'Restaurant Suspended'
          : status === 'APPROVED'
            ? 'Restaurant Approved'
            : 'Restaurant Status Changed';
      await this.audit.log({
        user: actor.user,
        ip: actor.ip,
        action,
        restaurantId: id,
        restaurantName: r.name,
        oldValue: r.status,
        newValue: status,
      });
    }
    return { ok: true, status };
  }

  async resetPassword(id: string, newPassword: string, actor?: AuditActor) {
    const staff = await this.prisma.staff.findMany({
      where: { restaurantId: id },
    });
    if (!staff.length) throw new NotFoundException('No staff for restaurant');
    const passwordHash = await bcrypt.hash(newPassword || 'password', 10);
    await this.prisma.staff.updateMany({
      where: { restaurantId: id },
      data: { passwordHash, firstLogin: true },
    });
    if (actor) {
      await this.audit.log({
        user: actor.user,
        ip: actor.ip,
        action: 'Password Reset',
        restaurantId: id,
        target: staff.map((s) => s.email).join(', '),
      });
    }
    return { ok: true };
  }

  async archiveRestaurant(id: string, actor?: AuditActor) {
    const r = await this.prisma.restaurant.findFirst({ where: { id } });
    if (!r) throw new NotFoundException('Restaurant not found');
    await this.prisma.restaurant.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date(), status: 'DISABLED' },
    });
    if (actor) {
      await this.audit.log({
        user: actor.user,
        ip: actor.ip,
        action: 'Restaurant Archived',
        restaurantId: id,
        restaurantName: r.name,
        target: r.name,
      });
    }
    return { ok: true };
  }

  /** Global statistics across all restaurants. */
  async stats() {
    const [restaurants, approved, pending, disabled, reservations, blocked] =
      await Promise.all([
        this.prisma.restaurant.count({ where: { isArchived: false } }),
        this.prisma.restaurant.count({
          where: { isArchived: false, status: 'APPROVED' },
        }),
        this.prisma.restaurant.count({
          where: { isArchived: false, status: 'PENDING' },
        }),
        this.prisma.restaurant.count({
          where: { isArchived: false, status: 'DISABLED' },
        }),
        this.prisma.reservation.count({ where: { isArchived: false } }),
        this.prisma.blockedPeriod.count({ where: { isArchived: false } }),
      ]);

    const today = new Date().toISOString().slice(0, 10);
    const todayReservations = await this.prisma.reservation.count({
      where: { isArchived: false, date: today },
    });

    return {
      restaurants,
      approved,
      pending,
      disabled,
      reservations,
      blockedPeriods: blocked,
      todayReservations,
    };
  }
}
