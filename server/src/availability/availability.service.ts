import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrenceService } from '../recurrence/recurrence.service';
import {
  serializeBlockedPeriod,
  serializeReservationPublic,
  serializeTable,
} from '../common/serializers';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toMin = (hhmm: string): number => {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (min: number): string => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const addDays = (date: string, days: number): string => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (date: string): string =>
  WEEKDAYS[new Date(date + 'T00:00:00Z').getUTCDay()];
const groupBy = <T>(rows: T[], key: keyof T): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(r[key]);
    const arr = m.get(k) ?? [];
    arr.push(r);
    m.set(k, arr);
  }
  return m;
};

export type DayStatus = 'available' | 'limited' | 'fully_booked' | 'closed';

/** Why a day is closed/fully-booked — lets the customer app show a specific,
 *  helpful message instead of a generic "Closed". null when bookable. */
export type DayReason =
  | 'holiday'
  | 'rest_day'
  | 'no_tables'
  | 'no_table_for_party'
  | 'fully_booked'
  | null;

export interface DaySummary {
  status: DayStatus;
  reason: DayReason;
  freeTables: number;
  totalTables: number;
  earliest: string | null; // earliest bookable slot "HH:mm", or null
}

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
      where: { id: restaurantId, isArchived: false, status: 'APPROVED', published: true },
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

  /** Resolve which blocks apply on a date (recurrence-expanded, zone-resolved). */
  private activeBlocksForDate(restaurant: any, allBlocks: any[], date: string) {
    const tablesByZone = new Map<string, string[]>();
    for (const t of restaurant.tables ?? []) {
      if (t.zoneId) {
        const arr = tablesByZone.get(t.zoneId) ?? [];
        arr.push(t.id);
        tablesByZone.set(t.zoneId, arr);
      }
    }
    return allBlocks
      .filter((b) =>
        b.type === 'SINGLE'
          ? b.date === date
          : this.recurrence.occursOn(b.recurrenceRule as any, date),
      )
      .map((b) => {
        let tableIds: string[] = b.tableIds ?? [];
        if (b.scope === 'ZONE' && b.zoneId) tableIds = tablesByZone.get(b.zoneId) ?? [];
        return { tableIds, startTime: b.startTime, endTime: b.endTime };
      });
  }

  /**
   * The heart of the rework: does a real bookable combination exist on `date`?
   * Returns a status (closed / fully_booked / limited / available), how many
   * tables still have a free slot, and the earliest such slot. When `guests` is
   * given, only tables that fit the party (minCapacity <= guests <= capacity)
   * count.
   */
  private computeDayStatus(
    restaurant: any,
    reservations: any[],
    activeBlocks: { tableIds: string[]; startTime: string; endTime: string }[],
    date: string,
    guests?: number,
  ): DaySummary {
    const holidays: any[] = (restaurant.holidayClosures as any) ?? [];
    const restDays: string[] = (restaurant.restDays as any) ?? [];
    const allTables = restaurant.tables ?? [];
    // Per-table minimum party size (optional) lives in resourceMeta. A table
    // fits a party when minCapacity <= guests <= capacity. No minCapacity means
    // a floor of 1 (even a single guest can book it).
    const resourceMeta: any = (restaurant.reservationRules as any)?.resourceMeta ?? {};
    const tableMin = (t: any) => resourceMeta[t.id]?.minCapacity || 1;
    const candidate = guests
      ? allTables.filter((t: any) => guests >= tableMin(t) && guests <= t.capacity)
      : allTables;
    const total = candidate.length;

    // Closure precedence: a specific holiday, then the weekly rest day, then a
    // restaurant with no tables at all. We surface which one so the customer
    // sees an exact reason ("Closed on Sundays" vs "Closed for a holiday").
    const isHoliday = holidays.some((h) => h?.date === date);
    const isRestDay = restDays.includes(weekdayOf(date));
    const noTables = allTables.length === 0;
    if (isHoliday || isRestDay || noTables) {
      const reason: DayReason = isHoliday ? 'holiday' : isRestDay ? 'rest_day' : 'no_tables';
      return { status: 'closed', reason, freeTables: 0, totalTables: total, earliest: null };
    }
    if (total === 0) {
      // No table can seat this party — treat as fully booked for them.
      return {
        status: 'fully_booked',
        reason: 'no_table_for_party',
        freeTables: 0,
        totalTables: 0,
        earliest: null,
      };
    }

    const opening = toMin(restaurant.openingTime);
    let kitchen = toMin(restaurant.kitchenClosing);
    let closing = toMin(restaurant.closingTime);
    if (closing <= opening) closing += 1440;
    if (kitchen <= opening) kitchen += 1440;
    const duration = restaurant.reservationRules?.defaultDurationMinutes ?? 120;

    const busy = new Map<string, { s: number; e: number }[]>();
    const addBusy = (tid: string, start: string, end: string) => {
      let s = toMin(start);
      let e = toMin(end);
      if (e <= s) e += 1440;
      if (s < opening) s = opening;
      const arr = busy.get(tid) ?? [];
      arr.push({ s, e });
      busy.set(tid, arr);
    };
    for (const r of reservations) if (r.tableId) addBusy(r.tableId, r.startTime, r.endTime);
    for (const b of activeBlocks)
      for (const tid of b.tableIds ?? []) addBusy(tid, b.startTime, b.endTime);

    let freeTables = 0;
    let earliest: number | null = null;
    for (const t of candidate) {
      const ivs = busy.get(t.id) ?? [];
      for (let s = opening; s < kitchen; s += 15) {
        const e = s + duration;
        if (e > closing) break;
        const free = !ivs.some((iv) => s < iv.e && e > iv.s);
        if (free) {
          freeTables++;
          if (earliest === null || s < earliest) earliest = s;
          break;
        }
      }
    }
    const status: DayStatus =
      freeTables === 0
        ? 'fully_booked'
        : freeTables <= Math.max(1, Math.ceil(total * 0.25))
          ? 'limited'
          : 'available';
    return {
      status,
      reason: status === 'fully_booked' ? 'fully_booked' : null,
      freeTables,
      totalTables: total,
      earliest: earliest != null ? fromMin(earliest) : null,
    };
  }

  /** Per-restaurant availability status for one date — powers the customer
   *  list "Available Today" filter and the "Fully Booked Today" badge. */
  async summarizeForDate(date: string) {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { isArchived: false, status: 'APPROVED', published: true },
      include: { tables: true },
    });
    const ids = restaurants.map((r) => r.id);
    const reservations = await this.prisma.reservation.findMany({
      where: { restaurantId: { in: ids }, date, isArchived: false, status: { notIn: ['CANCELLED'] } },
    });
    const blocks = await this.prisma.blockedPeriod.findMany({
      where: { restaurantId: { in: ids }, isArchived: false },
    });
    const resByRest = groupBy(reservations, 'restaurantId');
    const blkByRest = groupBy(blocks, 'restaurantId');
    return restaurants.map((r) => {
      const active = this.activeBlocksForDate(r, blkByRest.get(r.id) ?? [], date);
      const s = this.computeDayStatus(r, resByRest.get(r.id) ?? [], active, date);
      return { restaurantId: r.id, ...s };
    });
  }

  /** Day-by-day status across a date range — powers the calendar colouring. */
  async calendarFor(restaurantId: string, from: string, to: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, isArchived: false, status: 'APPROVED', published: true },
      include: { tables: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const reservations = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        date: { gte: from, lte: to },
        isArchived: false,
        status: { notIn: ['CANCELLED'] },
      },
    });
    const blocks = await this.prisma.blockedPeriod.findMany({
      where: { restaurantId, isArchived: false },
    });
    const resByDate = groupBy(reservations, 'date');
    // Per day: { status, reason } so the calendar can colour days AND explain
    // exactly why a day isn't bookable (holiday / rest day / fully booked).
    const days: Record<string, { status: DayStatus; reason: DayReason }> = {};
    let d = from;
    let guard = 0;
    while (d <= to && guard < 370) {
      const active = this.activeBlocksForDate(restaurant, blocks, d);
      const s = this.computeDayStatus(restaurant, resByDate.get(d) ?? [], active, d);
      days[d] = { status: s.status, reason: s.reason };
      d = addDays(d, 1);
      guard++;
    }
    return days;
  }

  /** First upcoming date (within ~60 days) that can take a booking. */
  async nextAvailability(restaurantId: string, from: string, guests?: number) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, isArchived: false, status: 'APPROVED', published: true },
      include: { tables: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const horizon = 60;
    const to = addDays(from, horizon);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        date: { gte: from, lte: to },
        isArchived: false,
        status: { notIn: ['CANCELLED'] },
      },
    });
    const blocks = await this.prisma.blockedPeriod.findMany({
      where: { restaurantId, isArchived: false },
    });
    const resByDate = groupBy(reservations, 'date');
    let d = from;
    for (let i = 0; i <= horizon; i++) {
      const active = this.activeBlocksForDate(restaurant, blocks, d);
      const s = this.computeDayStatus(restaurant, resByDate.get(d) ?? [], active, d, guests);
      if (s.status !== 'fully_booked' && s.status !== 'closed' && s.earliest) {
        return { date: d, time: s.earliest, status: s.status };
      }
      d = addDays(d, 1);
    }
    return { date: null, time: null, status: null };
  }
}
