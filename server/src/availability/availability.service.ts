import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrenceService } from '../recurrence/recurrence.service';
import {
  serializeBlockedPeriod,
  serializeReservationPublic,
  serializeTable,
} from '../common/serializers';

@Injectable()
export class AvailabilityService {
  constructor(
    private prisma: PrismaService,
    private recurrence: RecurrenceService,
  ) {}

  /**
   * Single combined availability payload for a restaurant + date.
   * Blocked periods are recurrence-expanded for the date and zone-resolved
   * into concrete tableIds so the customer app can treat them like reservations.
   */
  async getAvailability(restaurantId: string, date: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, isArchived: false },
      include: { tables: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const holidayClosures: any[] = (restaurant.holidayClosures as any) ?? [];
    const isHoliday = holidayClosures.some((h) => h?.date === date);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        date,
        isArchived: false,
        status: { notIn: ['CANCELLED'] },
      },
    });

    // All non-archived blocks; filter recurring by whether they occur on `date`.
    const allBlocks = await this.prisma.blockedPeriod.findMany({
      where: { restaurantId, isArchived: false },
    });

    const tablesByZone = new Map<string, string[]>();
    for (const t of restaurant.tables) {
      if (t.zoneId) {
        const arr = tablesByZone.get(t.zoneId) ?? [];
        arr.push(t.id);
        tablesByZone.set(t.zoneId, arr);
      }
    }

    const activeBlocks = allBlocks
      .filter((b) => {
        if (b.type === 'SINGLE') return b.date === date;
        return this.recurrence.occursOn(b.recurrenceRule as any, date);
      })
      .map((b) => {
        // Resolve zone-scoped blocks to concrete tableIds.
        let tableIds = b.tableIds ?? [];
        if (b.scope === 'ZONE' && b.zoneId) {
          tableIds = tablesByZone.get(b.zoneId) ?? [];
        }
        return { ...serializeBlockedPeriod(b), tableIds };
      });

    return {
      restaurantId,
      date,
      isHoliday,
      tables: restaurant.tables.map(serializeTable),
      reservations: reservations.map(serializeReservationPublic),
      blockedPeriods: activeBlocks,
      openingTime: restaurant.openingTime,
      kitchenClosing: restaurant.kitchenClosing,
      closingTime: restaurant.closingTime,
    };
  }
}
