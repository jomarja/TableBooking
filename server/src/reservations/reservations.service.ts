import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  serializeReservationFull,
  serializeReservationPublic,
} from '../common/serializers';

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

  /** Public booking from the customer app. */
  async createCustomer(dto: any) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: dto.restaurantId, isArchived: false },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const capacityRules: any = restaurant.capacityRules ?? {};
    const maxGuests =
      capacityRules.maxGuestsPerReservation ?? restaurant.maxGuests ?? 20;
    if (dto.guests > maxGuests) {
      throw new BadRequestException(`Maximum ${maxGuests} guests per reservation`);
    }

    // Per-slot reservation cap (large-event protection).
    const maxPerSlot = capacityRules.maxReservationsPerTimeSlot;
    if (maxPerSlot) {
      const sameSlot = await this.prisma.reservation.count({
        where: {
          restaurantId: dto.restaurantId,
          date: dto.date,
          startTime: dto.startTime,
          isArchived: false,
          status: { notIn: ['CANCELLED'] },
        },
      });
      if (sameSlot >= maxPerSlot) {
        throw new BadRequestException('This time slot is fully booked');
      }
    }

    // Derive end time from reservationRules if not supplied.
    let endTime = dto.endTime;
    if (!endTime) {
      endTime = this.suggestEndTime(restaurant, dto.startTime, dto.guests);
    }

    const policy: any = restaurant.reservationConfirmationPolicy ?? {
      autoConfirm: true,
    };
    const status = policy.autoConfirm === false ? 'PENDING' : 'CONFIRMED';

    const created = await this.prisma.reservation.create({
      data: {
        restaurantId: dto.restaurantId,
        tableId: dto.tableId ?? null,
        date: dto.date,
        startTime: dto.startTime,
        endTime,
        guests: dto.guests,
        name: dto.name ?? '',
        surname: dto.surname ?? '',
        phone: dto.phone ?? '',
        occasion: dto.occasion ?? null,
        customerNotes: dto.customerNotes ?? dto.specialRequest ?? null,
        source: 'CUSTOMER',
        status,
        events: {
          create: {
            action: 'created',
            user: 'customer',
            details: { source: 'customer' },
          },
        },
      },
    });
    return serializeReservationPublic(created);
  }

  private suggestEndTime(restaurant: any, startTime: string, guests: number) {
    const rules: any = restaurant.reservationRules ?? {};
    let duration = rules.defaultDurationMinutes ?? 120;
    const byGuests: any[] = rules.durationByGuests ?? [];
    const sorted = [...byGuests].sort((a, b) => a.maxGuests - b.maxGuests);
    for (const r of sorted) {
      if (guests <= r.maxGuests) {
        duration = r.minutes;
        break;
      }
    }
    const end = toMinutes(startTime) + duration;
    const h = Math.floor(end / 60) % 24;
    const m = end % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ---- Portal CRUD ----
  async listForRestaurant(restaurantId: string, date?: string) {
    const rows = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        isArchived: false,
        ...(date ? { date } : {}),
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map(serializeReservationFull);
  }

  async createByStaff(restaurantId: string, dto: any, source: 'STAFF' | 'ADMIN') {
    let endTime = dto.endTime;
    if (!endTime) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: restaurantId },
      });
      endTime = this.suggestEndTime(restaurant, dto.startTime, dto.guests ?? 2);
    }
    const created = await this.prisma.reservation.create({
      data: {
        restaurantId,
        tableId: dto.tableId ?? null,
        date: dto.date,
        startTime: dto.startTime,
        endTime,
        guests: dto.guests ?? 2,
        name: dto.name ?? '',
        surname: dto.surname ?? '',
        phone: dto.phone ?? '',
        occasion: dto.occasion ?? null,
        customerNotes: dto.customerNotes ?? null,
        staffNotes: dto.staffNotes ?? null,
        source,
        // Staff-entered bookings are walk-in/phone, not self-service online.
        channel: dto.channel ?? 'WALK_IN',
        status: dto.status ?? 'CONFIRMED',
        events: {
          create: { action: 'created', user: source.toLowerCase() },
        },
      },
    });
    return serializeReservationFull(created);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: any,
    user: string,
  ) {
    const existing = await this.prisma.reservation.findFirst({
      where: { id, restaurantId, isArchived: false },
    });
    if (!existing) throw new NotFoundException('Reservation not found');

    const actions: string[] = [];
    if (dto.tableId !== undefined && dto.tableId !== existing.tableId)
      actions.push('table_changed');
    if (dto.startTime !== undefined && dto.startTime !== existing.startTime)
      actions.push('time_changed');
    if (
      dto.endTime !== undefined &&
      dto.endTime !== existing.endTime &&
      !actions.includes('time_changed')
    )
      actions.push('resized');
    if (dto.date !== undefined && dto.date !== existing.date)
      actions.push('moved');
    if (dto.status !== undefined && dto.status !== existing.status)
      actions.push('status_changed');

    const data: any = {};
    for (const f of [
      'tableId',
      'date',
      'startTime',
      'endTime',
      'guests',
      'name',
      'surname',
      'phone',
      'occasion',
      'customerNotes',
      'staffNotes',
      'status',
      'channel',
    ]) {
      if (dto[f] !== undefined) data[f] = dto[f];
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data,
    });

    // Schedule-affecting changes log an event + enqueue a (mock) notification.
    const scheduleChanged = actions.some((a) =>
      ['table_changed', 'time_changed', 'resized', 'moved'].includes(a),
    );
    for (const action of actions.length ? actions : ['status_changed']) {
      await this.prisma.reservationEvent.create({
        data: { reservationId: id, action, user, details: dto },
      });
    }
    if (scheduleChanged) {
      await this.prisma.notification.create({
        data: {
          reservationId: id,
          type: 'SMS',
          message: `Your reservation at ${existing.date} ${existing.startTime} was updated. Please review.`,
          status: 'PENDING',
        },
      });
    }

    return {
      reservation: serializeReservationFull(updated),
      notifyCustomer: scheduleChanged,
      actions,
    };
  }

  async archive(restaurantId: string, id: string, user: string) {
    const existing = await this.prisma.reservation.findFirst({
      where: { id, restaurantId, isArchived: false },
    });
    if (!existing) throw new NotFoundException('Reservation not found');
    await this.prisma.reservation.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date(), status: 'CANCELLED' },
    });
    await this.prisma.reservationEvent.create({
      data: { reservationId: id, action: 'cancelled', user },
    });
    return { ok: true };
  }
}
