import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ImportService } from '../import/import.service';
import { serializeRestaurant } from '../common/serializers';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private importer: ImportService,
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

  /** Create a restaurant + its staff account. Optionally prefill via import. */
  async createRestaurant(dto: any) {
    const existing = await this.prisma.staff.findUnique({
      where: { email: dto.ownerEmail.toLowerCase().trim() },
    });
    if (existing) {
      throw new BadRequestException('A staff account with this email exists');
    }

    let prefill: any = {};
    if (dto.importUrl) {
      prefill = this.importer.prefill(dto.importUrl, 'GOOGLE_MAPS').data;
    }

    const passwordHash = await bcrypt.hash(dto.ownerPassword || 'password', 10);

    const restaurant = await this.prisma.restaurant.create({
      data: {
        name: dto.name || prefill.name || 'New Restaurant',
        cuisine: dto.cuisine || 'georgian',
        address: dto.address || prefill.address || '',
        website: dto.website || prefill.website || '',
        phone: dto.phone || prefill.phone || '',
        openingTime: prefill.openingTime || '10:00',
        kitchenClosing: prefill.kitchenClosing || '22:00',
        closingTime: prefill.closingTime || '23:00',
        openingHours: prefill.openingHours ?? undefined,
        status: 'PENDING',
        published: false,
        importSource: dto.importUrl ? 'GOOGLE_MAPS' : 'MANUAL',
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

  /** Re-sync one restaurant's Google data. */
  async syncRestaurant(id: string) {
    const r = await this.prisma.restaurant.findFirst({ where: { id, isArchived: false } });
    if (!r) throw new NotFoundException('Restaurant not found');
    const prefill = this.importer.prefill('', 'GOOGLE_MAPS').data as any;
    const data: any = { googleSyncedAt: new Date() };
    if (prefill.openingTime) data.openingTime = prefill.openingTime;
    if (prefill.kitchenClosing) data.kitchenClosing = prefill.kitchenClosing;
    if (prefill.closingTime) data.closingTime = prefill.closingTime;
    if (prefill.openingHours) data.openingHours = prefill.openingHours;
    if (prefill.website) data.website = prefill.website;
    if (prefill.phone) data.phone = prefill.phone;
    if (prefill.rating) data.rating = prefill.rating;
    if (prefill.reviewCount) data.reviewCount = prefill.reviewCount;
    await this.prisma.restaurant.update({ where: { id }, data });
    return { ok: true };
  }

  /** Sync all non-archived restaurants. */
  async syncAllRestaurants() {
    const ids = await this.prisma.restaurant.findMany({
      where: { isArchived: false },
      select: { id: true },
    });
    for (const { id } of ids) {
      await this.syncRestaurant(id);
    }
    return { ok: true, count: ids.length };
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
