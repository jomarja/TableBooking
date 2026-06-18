import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrenceService } from '../recurrence/recurrence.service';
import {
  serializeBlockedPeriod,
  serializeReservationFull,
} from '../common/serializers';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private recurrence: RecurrenceService,
  ) {}

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
      include: { reservation: { select: { name: true, surname: true } } },
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
      blockedToday: todayBlocks.map(serializeBlockedPeriod),
      recentActivity: recentEvents.map((e) => ({
        id: e.id,
        action: e.action,
        user: e.user,
        timestamp: e.timestamp,
        customer: e.reservation
          ? `${e.reservation.name} ${e.reservation.surname}`.trim()
          : '',
      })),
    };
  }
}
