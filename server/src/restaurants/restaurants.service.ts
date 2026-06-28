import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  serializeRestaurant,
} from '../common/serializers';
import { AuditService, type AuditActor } from '../audit/audit.service';

const restaurantInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  menu: { orderBy: { sortOrder: 'asc' as const } },
  zones: true,
  tables: true,
  floorPlanElements: true,
};

@Injectable()
export class RestaurantsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /** Public list — only approved + published, not archived. */
  async findAllPublic() {
    const rows = await this.prisma.restaurant.findMany({
      where: { isArchived: false, status: 'APPROVED', published: true },
      include: restaurantInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(serializeRestaurant);
  }

  async findOnePublic(id: string) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id, isArchived: false, status: 'APPROVED', published: true },
      include: restaurantInclude,
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    return serializeRestaurant(r);
  }

  /** Portal read — staff fetching their own restaurant regardless of publish state. */
  async findOneForStaff(id: string) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id, isArchived: false },
      include: restaurantInclude,
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    return serializeRestaurant(r);
  }

  private assertOwnership(restaurantId: string, userRestaurantId?: string) {
    if (!userRestaurantId || userRestaurantId !== restaurantId) {
      throw new ForbiddenException('You can only modify your own restaurant');
    }
  }

  /** Update core info / hours / config / publish. */
  async update(
    id: string,
    userRestaurantId: string | undefined,
    dto: any,
    actor?: AuditActor,
  ) {
    this.assertOwnership(id, userRestaurantId);
    const before = actor
      ? await this.prisma.restaurant.findUnique({ where: { id } })
      : null;
    const data: any = {};
    const scalarFields = [
      'name',
      'cuisine',
      'address',
      'website',
      'phone',
      'timezone',
      'openingTime',
      'kitchenClosing',
      'closingTime',
      'priceRange',
      'priceLevel',
      'allowTableSelection',
      'maxGuests',
      'published',
      'outdoorSeating',
      'familyFriendly',
      'floorPlanBackground',
      'description',
      'restDays',
      'cuisines',
      'lat',
      'lng',
    ];
    for (const f of scalarFields) {
      if (dto[f] !== undefined) data[f] = dto[f];
    }
    const jsonFields = [
      'openingHours',
      'reservationRules',
      'reservationConfirmationPolicy',
      'capacityRules',
      'holidayClosures',
    ];
    for (const f of jsonFields) {
      if (dto[f] !== undefined) data[f] = dto[f];
    }

    // First-time publish flips firstLogin off for the owner's staff.
    if (dto.published === true) {
      await this.prisma.staff.updateMany({
        where: { restaurantId: id },
        data: { firstLogin: false },
      });
    }

    await this.prisma.restaurant.update({ where: { id }, data });
    if (actor && before) await this.auditRestaurantUpdate(id, before, dto, actor);
    return this.findOneForStaff(id);
  }

  /** Audit accurate (real-diff) opening-hours and settings changes. */
  private async auditRestaurantUpdate(
    id: string,
    before: any,
    dto: any,
    actor: AuditActor,
  ) {
    const hoursFields = ['openingTime', 'kitchenClosing', 'closingTime'];
    const hoursChanged =
      hoursFields.some((f) => dto[f] !== undefined && dto[f] !== before[f]) ||
      (dto.openingHours !== undefined &&
        JSON.stringify(dto.openingHours) !== JSON.stringify(before.openingHours));
    if (hoursChanged) {
      await this.audit.log({
        user: actor.user,
        ip: actor.ip,
        action: 'Opening Hours Changed',
        restaurantId: id,
        oldValue: `${before.openingTime}–${before.closingTime}`,
        newValue: `${dto.openingTime ?? before.openingTime}–${dto.closingTime ?? before.closingTime}`,
      });
    }
    const settingFields = [
      'name', 'cuisine', 'address', 'website', 'phone', 'priceRange',
      'priceLevel', 'allowTableSelection', 'maxGuests', 'published',
      'outdoorSeating', 'familyFriendly', 'description', 'restDays', 'cuisines',
      'reservationRules', 'reservationConfirmationPolicy', 'capacityRules',
    ];
    const changed = settingFields.filter(
      (f) =>
        dto[f] !== undefined &&
        JSON.stringify(dto[f]) !== JSON.stringify(before[f]),
    );
    if (changed.length) {
      await this.audit.log({
        user: actor.user,
        ip: actor.ip,
        action: 'Restaurant Settings Changed',
        restaurantId: id,
        target: changed.join(', '),
        newValue: changed.join(', '),
      });
    }
  }

  /** Reconcile zones (update in place, create new, delete removed) — like
   *  setTables. A delete-and-recreate would null every table's zoneId via
   *  onDelete: SetNull, unassigning tables; reconciling keeps kept zones' ids
   *  so table↔zone links survive. Shared by the wizard, floor plan and the
   *  Resources page, so zones stay in sync everywhere. */
  async setZones(
    id: string,
    userRestaurantId: string | undefined,
    zones: { id?: string; name: string }[],
  ) {
    this.assertOwnership(id, userRestaurantId);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.zone.findMany({
        where: { restaurantId: id },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((z) => z.id));
      const incomingIds = new Set<string>();
      for (const z of zones) {
        if (z.id && existingIds.has(z.id)) {
          incomingIds.add(z.id);
          await tx.zone.update({ where: { id: z.id }, data: { name: z.name } });
        } else {
          const created = await tx.zone.create({
            data: { id: z.id || undefined, restaurantId: id, name: z.name },
          });
          incomingIds.add(created.id);
        }
      }
      const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid));
      if (toDelete.length) {
        await tx.zone.deleteMany({ where: { id: { in: toDelete } } });
      }
    });
    return this.findOneForStaff(id);
  }

  /** Reconcile the restaurant's tables to the supplied set. We update existing
   *  tables in place, create new ones, and delete only the ones that were
   *  removed — rather than wiping & recreating. This preserves each kept table's
   *  id and, crucially, its reservations' `tableId` (a full delete would fire
   *  onDelete: SetNull and unassign every booking). Only genuinely-removed
   *  tables detach their reservations. Shared by the Floor Plan builder and the
   *  Resources page, so both stay in sync on the same Table rows. */
  async setTables(
    id: string,
    userRestaurantId: string | undefined,
    tables: any[],
    actor?: AuditActor,
  ) {
    this.assertOwnership(id, userRestaurantId);
    const fields = (t: any) => ({
      number: t.number,
      capacity: t.capacity,
      shape: t.shape ?? 'CIRCLE',
      zoneId: t.zoneId ?? null,
      tags: t.tags ?? [],
      mergeGroup: t.mergeGroup ?? null,
      posX: t.position?.x ?? t.posX ?? 50,
      posY: t.position?.y ?? t.posY ?? 50,
      width: t.size?.width ?? t.width ?? 8,
      height: t.size?.height ?? t.height ?? 8,
      rotation: t.rotation ?? 0,
    });
    // Snapshot before-state so we can audit capacity changes / adds / removes.
    const before = await this.prisma.table.findMany({
      where: { restaurantId: id },
      select: { id: true, number: true, capacity: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const existingIds = new Set(before.map((t) => t.id));
      const incomingIds = new Set<string>();

      for (const t of tables) {
        const data = fields(t);
        // Reuse the incoming id when present; only fall back to a generated id
        // for brand-new tables that arrive without one.
        if (t.id && existingIds.has(t.id)) {
          incomingIds.add(t.id);
          await tx.table.update({ where: { id: t.id }, data });
        } else {
          const created = await tx.table.create({
            data: { ...data, id: t.id || undefined, restaurantId: id },
          });
          incomingIds.add(created.id);
        }
      }

      // Delete only tables that are no longer present (these detach their
      // reservations via SetNull, which is the desired behaviour on removal).
      const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid));
      if (toDelete.length) {
        await tx.table.deleteMany({ where: { id: { in: toDelete } } });
      }
    });
    if (actor) await this.auditTableChanges(id, before, tables, actor);
    return this.findOneForStaff(id);
  }

  /** Emit audit entries for table capacity changes, additions and removals. */
  private async auditTableChanges(
    restaurantId: string,
    before: { id: string; number: number; capacity: number }[],
    incoming: any[],
    actor: AuditActor,
  ) {
    const beforeById = new Map(before.map((t) => [t.id, t]));
    const incomingIds = new Set<string>();
    for (const t of incoming) {
      if (t.id) incomingIds.add(t.id);
      const old = t.id ? beforeById.get(t.id) : undefined;
      if (old) {
        if (typeof t.capacity === 'number' && t.capacity !== old.capacity) {
          await this.audit.log({
            user: actor.user,
            ip: actor.ip,
            action: 'Table Capacity Changed',
            restaurantId,
            target: `Table ${t.number ?? old.number}`,
            oldValue: `${old.capacity} seats`,
            newValue: `${t.capacity} seats`,
          });
        }
      } else {
        await this.audit.log({
          user: actor.user,
          ip: actor.ip,
          action: 'Resource Created',
          restaurantId,
          target: `Table ${t.number ?? ''}`.trim(),
        });
      }
    }
    for (const old of before) {
      if (!incomingIds.has(old.id)) {
        await this.audit.log({
          user: actor.user,
          ip: actor.ip,
          action: 'Resource Deleted',
          restaurantId,
          target: `Table ${old.number}`,
        });
      }
    }
  }

  /** Replace floor-plan elements (+ optional background). */
  async setFloorPlan(
    id: string,
    userRestaurantId: string | undefined,
    payload: { elements: any[]; background?: string | null },
  ) {
    this.assertOwnership(id, userRestaurantId);
    await this.prisma.$transaction(async (tx) => {
      await tx.floorPlanElement.deleteMany({ where: { restaurantId: id } });
      for (const e of payload.elements ?? []) {
        await tx.floorPlanElement.create({
          data: {
            id: e.id,
            restaurantId: id,
            type: e.type,
            posX: e.position?.x ?? e.posX ?? 0,
            posY: e.position?.y ?? e.posY ?? 0,
            width: e.size?.width ?? e.width ?? 10,
            height: e.size?.height ?? e.height ?? 10,
            rotation: e.rotation ?? 0,
            metadata: e.metadata ?? {},
          },
        });
      }
      if (payload.background !== undefined) {
        await tx.restaurant.update({
          where: { id },
          data: { floorPlanBackground: payload.background },
        });
      }
    });
    return this.findOneForStaff(id);
  }

  /** Add a single image. */
  async addImage(id: string, userRestaurantId: string | undefined, url: string, type = 'INTERIOR') {
    this.assertOwnership(id, userRestaurantId);
    const count = await this.prisma.restaurantImage.count({ where: { restaurantId: id } });
    await this.prisma.restaurantImage.create({
      data: { restaurantId: id, url, type: type as any, sortOrder: count },
    });
    return this.findOneForStaff(id);
  }

  /** Delete an image. */
  async deleteImage(id: string, userRestaurantId: string | undefined, imageId: string) {
    this.assertOwnership(id, userRestaurantId);
    await this.prisma.restaurantImage.deleteMany({ where: { id: imageId, restaurantId: id } });
    return this.findOneForStaff(id);
  }

  /** Add a menu item. */
  async addMenuItem(id: string, userRestaurantId: string | undefined, data: any) {
    this.assertOwnership(id, userRestaurantId);
    const count = await this.prisma.menuItem.count({ where: { restaurantId: id } });
    await this.prisma.menuItem.create({
      data: {
        restaurantId: id,
        category: data.category ?? 'Main',
        name: data.name,
        description: data.description ?? '',
        price: data.price ?? '',
        photo: data.photo ?? null,
        sortOrder: count,
      },
    });
    return this.findOneForStaff(id);
  }

  /** Update a menu item. */
  async updateMenuItem(id: string, userRestaurantId: string | undefined, itemId: string, data: any) {
    this.assertOwnership(id, userRestaurantId);
    const fields: any = {};
    if (data.category !== undefined) fields.category = data.category;
    if (data.name !== undefined) fields.name = data.name;
    if (data.description !== undefined) fields.description = data.description;
    if (data.price !== undefined) fields.price = data.price;
    if (data.photo !== undefined) fields.photo = data.photo;
    await this.prisma.menuItem.updateMany({ where: { id: itemId, restaurantId: id }, data: fields });
    return this.findOneForStaff(id);
  }

  /** Delete a menu item. */
  async deleteMenuItem(id: string, userRestaurantId: string | undefined, itemId: string) {
    this.assertOwnership(id, userRestaurantId);
    await this.prisma.menuItem.deleteMany({ where: { id: itemId, restaurantId: id } });
    return this.findOneForStaff(id);
  }

  /** reservation-config endpoint payload. */
  async reservationConfig(id: string) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id, isArchived: false },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    const rules: any = r.reservationRules ?? {};
    const cap: any = r.capacityRules ?? {};
    return {
      openingTime: r.openingTime,
      kitchenClosing: r.kitchenClosing,
      closingTime: r.closingTime,
      maxGuests: r.maxGuests,
      defaultDuration: rules.defaultDurationMinutes ?? 120,
      durationByGuests: rules.durationByGuests ?? [],
      // Online rules so the customer app reflects every reservation setting.
      minGroupSize: rules.minGroupSize ?? 1,
      maxGroupSize: rules.maxGroupSize ?? r.maxGuests ?? 20,
      // The per-reservation guest cap (capacityRules + maxGuests scalar) — the
      // customer guest selector caps at the smallest of these.
      maxGuestsPerReservation: cap.maxGuestsPerReservation ?? r.maxGuests ?? null,
      intervalMinutes: rules.intervalMinutes ?? 30,
      onlineEnabled: rules.onlineEnabled !== false,
      minLeadTimeMinutes: rules.minLeadTimeMinutes ?? 0,
      maxBookingWindowDays: rules.maxBookingWindowDays ?? 0,
      sameDayCutoff: rules.sameDayCutoff ?? { mode: 'disabled' },
      requiredFields: rules.requiredFields ?? null,
      reservationNotice: rules.reservationNotice ?? '',
      allowTableSelection: r.allowTableSelection,
      reservationConfirmationPolicy: r.reservationConfirmationPolicy ?? {
        autoConfirm: true,
      },
      capacityRules: r.capacityRules ?? {
        maxGuestsPerReservation: r.maxGuests,
        maxReservationsPerTimeSlot: 999,
      },
      holidayClosures: r.holidayClosures ?? [],
    };
  }
}
