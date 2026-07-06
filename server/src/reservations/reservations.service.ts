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
import { CustomerMetaService, type CustomerMeta } from './customer-meta.service';
import { RecurrenceService } from '../recurrence/recurrence.service';

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private customerMeta: CustomerMetaService,
    private recurrence: RecurrenceService,
  ) {}

  /** Two HH:mm intervals overlap? Cross-midnight aware (end<=start => +1 day). */
  private timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
    let a1 = toMinutes(s1);
    let b1 = toMinutes(e1);
    if (b1 <= a1) b1 += 1440;
    let a2 = toMinutes(s2);
    let b2 = toMinutes(e2);
    if (b2 <= a2) b2 += 1440;
    return a1 < b2 && b1 > a2;
  }

  /** Reject if another (non-cancelled) reservation already occupies this table at
   *  an overlapping time — a table can't be double-booked. Unassigned (no table)
   *  reservations can't clash. excludeId skips the row being updated. */
  private async assertNoTableOverlap(
    restaurantId: string,
    tableId: string | null | undefined,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ) {
    if (!tableId) return;
    const others = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        tableId,
        date,
        isArchived: false,
        status: { notIn: ['CANCELLED'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    for (const r of others) {
      if (this.timesOverlap(startTime, endTime, r.startTime, r.endTime)) {
        throw new BadRequestException(
          `This table already has a reservation from ${r.startTime} to ${r.endTime}.`,
        );
      }
    }
  }

  /** Reject placing a reservation during a blocked period for its table, unless
   *  the restaurant opted in via reservationRules.allowReservationsOverBlocks. */
  private async assertNotOverBlock(
    restaurant: any,
    tableId: string | null | undefined,
    date: string,
    startTime: string,
    endTime: string,
  ) {
    if (!restaurant) return;
    const rules: any = restaurant.reservationRules ?? {};
    if (rules.allowReservationsOverBlocks === true) return;
    if (!tableId) return;
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      select: { zoneId: true },
    });
    const blocks = await this.prisma.blockedPeriod.findMany({
      where: { restaurantId: restaurant.id, isArchived: false },
    });
    for (const b of blocks) {
      const occurs =
        b.type === 'SINGLE'
          ? b.date === date
          : this.recurrence.occursOn(b.recurrenceRule as any, date);
      if (!occurs) continue;
      const appliesToTable =
        (b.scope === 'TABLES' && (b.tableIds ?? []).includes(tableId)) ||
        (b.scope === 'ZONE' && !!b.zoneId && table?.zoneId === b.zoneId);
      if (!appliesToTable) continue;
      if (this.timesOverlap(startTime, endTime, b.startTime, b.endTime)) {
        throw new BadRequestException(
          `This table is blocked from ${b.startTime} to ${b.endTime}${b.reason ? ` (${b.reason})` : ''}.`,
        );
      }
    }
  }

  /** Public booking from the customer app. */
  async createCustomer(dto: any) {
    if (dto.tableId === '') dto.tableId = null; // "no resource" → unassigned, not a FK
    // Only publicly-bookable restaurants accept customer bookings — a PENDING,
    // DISABLED or unpublished restaurant must not be reachable via the API.
    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        id: dto.restaurantId,
        isArchived: false,
        status: 'APPROVED',
        published: true,
      },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // ---- Online reservation rules (configured in Reservation Settings) ----
    const rules: any = restaurant.reservationRules ?? {};
    if (rules.onlineEnabled === false) {
      throw new BadRequestException(
        'Online reservations are currently unavailable. Please contact the restaurant.',
      );
    }
    if (rules.minGroupSize && dto.guests < rules.minGroupSize) {
      throw new BadRequestException(
        `The minimum group size for online booking is ${rules.minGroupSize}.`,
      );
    }
    if (rules.maxGroupSize && dto.guests > rules.maxGroupSize) {
      throw new BadRequestException('For larger groups please contact the restaurant directly.');
    }
    if (rules.minLeadTimeMinutes) {
      const startMs = new Date(`${dto.date}T${dto.startTime}:00`).getTime();
      if (!Number.isNaN(startMs) && startMs - Date.now() < rules.minLeadTimeMinutes * 60000) {
        throw new BadRequestException(
          `Please book at least ${rules.minLeadTimeMinutes} minutes in advance.`,
        );
      }
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (rules.maxBookingWindowDays) {
      const max = new Date();
      max.setDate(max.getDate() + rules.maxBookingWindowDays);
      if (dto.date > max.toISOString().slice(0, 10)) {
        throw new BadRequestException(
          `Reservations can only be made up to ${rules.maxBookingWindowDays} days ahead.`,
        );
      }
    }
    if (dto.date === todayStr && rules.sameDayCutoff && rules.sameDayCutoff.mode && rules.sameDayCutoff.mode !== 'disabled') {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      let cutoffMin: number | null = null;
      if (rules.sameDayCutoff.mode === 'time' && rules.sameDayCutoff.time) {
        cutoffMin = toMinutes(rules.sameDayCutoff.time);
      } else if (rules.sameDayCutoff.mode === 'beforeClose' && rules.sameDayCutoff.hoursBeforeClose != null) {
        cutoffMin = toMinutes(restaurant.closingTime) - rules.sameDayCutoff.hoursBeforeClose * 60;
      }
      if (cutoffMin != null && nowMin > cutoffMin) {
        throw new BadRequestException('Same-day online reservations are no longer available for today.');
      }
    }

    const capacityRules: any = restaurant.capacityRules ?? {};
    if (capacityRules.maxOnlineReservationsPerDay) {
      const onlineCount = await this.prisma.reservation.count({
        where: {
          restaurantId: dto.restaurantId,
          date: dto.date,
          source: 'CUSTOMER',
          isArchived: false,
          status: { notIn: ['CANCELLED'] },
        },
      });
      if (onlineCount >= capacityRules.maxOnlineReservationsPerDay) {
        throw new BadRequestException(
          'Online reservations for this day are full. Please contact the restaurant.',
        );
      }
    }
    const maxGuests =
      capacityRules.maxGuestsPerReservation ?? restaurant.maxGuests ?? 20;
    if (dto.guests > maxGuests) {
      throw new BadRequestException(`Maximum ${maxGuests} guests per reservation`);
    }

    // Per-table fit: a chosen table only takes parties within [minCapacity..
    // capacity]. minCapacity (optional) lives in reservationRules.resourceMeta;
    // absent means a floor of 1 (anyone can book). Mirrors the customer UI.
    if (dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId, restaurantId: dto.restaurantId },
      });
      if (table) {
        const minCap = rules.resourceMeta?.[table.id]?.minCapacity || 1;
        if (dto.guests < minCap) {
          throw new BadRequestException(`This table is for groups of ${minCap} or more.`);
        }
        if (dto.guests > table.capacity) {
          throw new BadRequestException(`This table seats up to ${table.capacity} guests.`);
        }
      }
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

    // Per-interval guest cap — total seated guests starting in the same slot.
    const maxGuestsPerInterval = capacityRules.maxGuestsPerInterval;
    if (maxGuestsPerInterval) {
      const agg = await this.prisma.reservation.aggregate({
        _sum: { guests: true },
        where: {
          restaurantId: dto.restaurantId,
          date: dto.date,
          startTime: dto.startTime,
          isArchived: false,
          status: { notIn: ['CANCELLED'] },
        },
      });
      if ((agg._sum.guests ?? 0) + dto.guests > maxGuestsPerInterval) {
        throw new BadRequestException('This time slot has reached its guest capacity.');
      }
    }

    // Derive end time from reservationRules if not supplied.
    let endTime = dto.endTime;
    if (!endTime) {
      endTime = this.suggestEndTime(restaurant, dto.startTime, dto.guests);
    }

    // A table can't be double-booked, and (by default) not booked over a block.
    await this.assertNoTableOverlap(dto.restaurantId, dto.tableId, dto.date, dto.startTime, endTime);
    await this.assertNotOverBlock(restaurant, dto.tableId, dto.date, dto.startTime, endTime);

    // Confirmation mode (Reservation Settings → Online): 'auto' confirms
    // instantly; 'manual'/'hybrid' enter the dashboard approval queue as PENDING.
    const policy: any = restaurant.reservationConfirmationPolicy ?? {};
    const status = policy.approvalMode === 'auto' ? 'CONFIRMED' : 'PENDING';

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
    // Persist email/address (from the booking form's required fields) into the
    // CRM meta keyed by phone, so they show on the staff customer profile.
    if (dto.phone && (dto.email || dto.address)) {
      const existing = await this.customerMeta.get(dto.restaurantId, dto.phone);
      await this.customerMeta.set(dto.restaurantId, dto.phone, {
        ...existing,
        ...(dto.email ? { email: dto.email } : {}),
        ...(dto.address ? { address: dto.address } : {}),
      });
    }
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

  /** Aggregate a customer's profile + full reservation history by phone, scoped
   *  to the restaurant. Powers the portal customer-profile page. */
  async customerProfile(restaurantId: string, phone: string) {
    const rows = await this.prisma.reservation.findMany({
      where: { restaurantId, phone, isArchived: false },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });
    const latest = rows[0];
    const meta = await this.customerMeta.get(restaurantId, phone);
    return {
      customer: {
        name: latest?.name ?? '',
        surname: latest?.surname ?? '',
        phone,
        occasion: latest?.occasion ?? null,
        customerNotes: latest?.customerNotes ?? null,
        staffNotes: latest?.staffNotes ?? null,
        totalVisits: rows.filter((r) => r.status === 'COMPLETED').length,
        email: meta.email ?? null,
        birthday: meta.birthday ?? null,
        company: meta.company ?? null,
        address: meta.address ?? null,
        tags: meta.tags ?? [],
        notes: meta.notes ?? null,
      },
      reservations: rows.map(serializeReservationFull),
    };
  }

  /** Save CRM-style customer details (email, birthday, tags, …). */
  saveCustomerMeta(restaurantId: string, phone: string, meta: CustomerMeta) {
    return this.customerMeta.set(restaurantId, phone, meta);
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
      // Latest event so the modal can show "Edited by".
      include: { events: { orderBy: { timestamp: 'desc' }, take: 1 } },
    });
    return rows.map(serializeReservationFull);
  }

  async createByStaff(restaurantId: string, dto: any, source: 'STAFF' | 'ADMIN') {
    if (dto.tableId === '') dto.tableId = null; // "no resource" → unassigned, not a FK
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    let endTime = dto.endTime;
    if (!endTime) {
      endTime = this.suggestEndTime(restaurant, dto.startTime, dto.guests ?? 2);
    }
    // Enforce the same integrity rules as customer bookings.
    await this.assertNoTableOverlap(restaurantId, dto.tableId, dto.date, dto.startTime, endTime);
    await this.assertNotOverBlock(restaurant, dto.tableId, dto.date, dto.startTime, endTime);
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
    // "No resource" comes through as '' — store null, not an invalid FK.
    if (data.tableId === '') data.tableId = null;

    // Human-readable change summary for the audit log ("Table 4 → 7", etc.).
    const parts: string[] = [];
    if (dto.guests !== undefined && dto.guests !== existing.guests)
      parts.push(`guests ${existing.guests} → ${dto.guests}`);
    if (dto.startTime !== undefined && dto.startTime !== existing.startTime)
      parts.push(`time ${existing.startTime} → ${dto.startTime}`);
    if (dto.date !== undefined && dto.date !== existing.date)
      parts.push(`date ${existing.date} → ${dto.date}`);
    if (dto.tableId !== undefined && dto.tableId !== existing.tableId) {
      const [oldT, newT] = await Promise.all([
        existing.tableId
          ? this.prisma.table.findUnique({ where: { id: existing.tableId }, select: { number: true } })
          : null,
        dto.tableId
          ? this.prisma.table.findUnique({ where: { id: dto.tableId }, select: { number: true } })
          : null,
      ]);
      parts.push(`Table ${oldT?.number ?? '—'} → Table ${newT?.number ?? '—'}`);
    }

    // Re-validate integrity when any schedule field changes (move/resize/table/
    // date). Pure status/notes edits skip this so cancelling/seating always work.
    const scheduleFieldChanged =
      dto.tableId !== undefined ||
      dto.date !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined;
    if (scheduleFieldChanged) {
      const effTableId = dto.tableId !== undefined ? dto.tableId : existing.tableId;
      const effDate = dto.date ?? existing.date;
      const effStart = dto.startTime ?? existing.startTime;
      const effEnd = dto.endTime ?? existing.endTime;
      await this.assertNoTableOverlap(restaurantId, effTableId, effDate, effStart, effEnd, id);
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: restaurantId },
      });
      await this.assertNotOverBlock(restaurant, effTableId, effDate, effStart, effEnd);
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
      summary: parts.join(' · '),
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
