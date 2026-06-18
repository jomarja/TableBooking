import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { serializeRestaurant } from '../common/serializers';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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
  async createRestaurant(dto: any) {
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

    return {
      restaurant: serializeRestaurant(restaurant),
      staff: restaurant.staff.map((s) => ({ id: s.id, email: s.email })),
    };
  }

  async setStatus(id: string, status: 'PENDING' | 'APPROVED' | 'DISABLED') {
    const r = await this.prisma.restaurant.findFirst({
      where: { id, isArchived: false },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    await this.prisma.restaurant.update({ where: { id }, data: { status } });
    return { ok: true, status };
  }

  async resetPassword(id: string, newPassword: string) {
    const staff = await this.prisma.staff.findMany({
      where: { restaurantId: id },
    });
    if (!staff.length) throw new NotFoundException('No staff for restaurant');
    const passwordHash = await bcrypt.hash(newPassword || 'password', 10);
    await this.prisma.staff.updateMany({
      where: { restaurantId: id },
      data: { passwordHash, firstLogin: true },
    });
    return { ok: true };
  }

  async archiveRestaurant(id: string) {
    const r = await this.prisma.restaurant.findFirst({ where: { id } });
    if (!r) throw new NotFoundException('Restaurant not found');
    await this.prisma.restaurant.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date(), status: 'DISABLED' },
    });
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
