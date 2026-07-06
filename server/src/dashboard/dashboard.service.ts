import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrenceService } from '../recurrence/recurrence.service';
import {
  serializeBlockedPeriod,
  serializeReservationFull,
} from '../common/serializers';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const addDays = (date: string, n: number): string => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (date: string): string =>
  WEEKDAYS[new Date(date + 'T00:00:00Z').getUTCDay()];

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private recurrence: RecurrenceService,
  ) {}

  /** 7-day demand overview (Today, Tomorrow, …) for the dashboard cards. */
  async weekOverview(restaurantId: string, from?: string) {
    const start = from || new Date().toISOString().slice(0, 10);
    const end = addDays(start, 6);
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    const restDays: string[] = (restaurant?.restDays as any) ?? [];
    const holidays: any[] = (restaurant?.holidayClosures as any) ?? [];
    const reservations = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        date: { gte: start, lte: end },
        isArchived: false,
        status: { notIn: ['CANCELLED'] },
      },
    });
    const days: {
      date: string;
      weekday: string;
      reservations: number;
      guests: number;
      closed: boolean;
    }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const dayRes = reservations.filter((r) => r.date === date);
      const closed =
        holidays.some((h) => h?.date === date) || restDays.includes(weekdayOf(date));
      days.push({
        date,
        weekday: weekdayOf(date),
        reservations: dayRes.length,
        guests: dayRes.reduce((s, r) => s + r.guests, 0),
        closed,
      });
    }
    return { from: start, days };
  }

  /** Operations-view summary for a restaurant on a given date (defaults to today). */
  async summary(restaurantId: string, date?: string) {
    const day = date || new Date().toISOString().slice(0, 10);

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { tables: true },
    });
    const tableCount = restaurant?.tables.length ?? 0;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        date: day,
        isArchived: false,
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: { startTime: 'asc' },
    });

    const upcoming = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        isArchived: false,
        date: { gt: day },
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 10,
    });

    // Online reservations awaiting staff approval (the dashboard queue).
    const pendingOnline = await this.prisma.reservation.findMany({
      where: { restaurantId, isArchived: false, status: 'PENDING', date: { gte: day } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const allBlocks = await this.prisma.blockedPeriod.findMany({
      where: { restaurantId, isArchived: false },
    });
    const todayBlocks = allBlocks.filter((b) =>
      b.type === 'SINGLE'
        ? b.date === day
        : this.recurrence.occursOn(b.recurrenceRule as any, day),
    );

    const expectedGuests = reservations.reduce((sum, r) => sum + r.guests, 0);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const tablesInUse = new Set(
      reservations
        .filter((r) => {
          const [sh, sm] = r.startTime.split(':').map(Number);
          const [eh, em] = r.endTime.split(':').map(Number);
          const start = sh * 60 + sm;
          let end = eh * 60 + em;
          if (end < start) end += 24 * 60;
          return currentMinutes >= start && currentMinutes <= end;
        })
        .map((r) => r.tableId)
        .filter(Boolean),
    ).size;

    const occupancy =
      tableCount > 0 ? Math.round((tablesInUse / tableCount) * 100) : 0;

    const arrivalsRemaining = reservations.filter((r) => {
      const [sh, sm] = r.startTime.split(':').map(Number);
      return sh * 60 + sm >= currentMinutes;
    }).length;

    const recentEvents = await this.prisma.reservationEvent.findMany({
      where: { reservation: { restaurantId } },
      orderBy: { timestamp: 'desc' },
      take: 12,
      include: { reservation: { select: { name: true, surname: true, date: true } } },
    });

    return {
      date: day,
      stats: {
        todayReservations: reservations.length,
        expectedGuests,
        occupancy,
        upcomingArrivals: arrivalsRemaining,
        blockedPeriods: todayBlocks.length,
        availableTables: Math.max(tableCount - tablesInUse, 0),
        totalTables: tableCount,
      },
      todayReservations: reservations.map(serializeReservationFull),
      upcomingReservations: upcoming.map(serializeReservationFull),
      pendingOnline: pendingOnline.map(serializeReservationFull),
      blockedToday: todayBlocks.map(serializeBlockedPeriod),
      recentActivity: recentEvents.map((e) => ({
        id: e.id,
        action: e.action,
        user: e.user,
        timestamp: e.timestamp,
        customer: e.reservation
          ? `${e.reservation.name} ${e.reservation.surname}`.trim()
          : '',
        // Deep-link target so the dashboard can jump to this booking in the scheduler.
        reservationId: e.reservationId ?? null,
        date: e.reservation?.date ?? null,
      })),
    };
  }
}
