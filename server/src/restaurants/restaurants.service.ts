import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  serializeRestaurant,
} from '../common/serializers';

const restaurantInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  menu: { orderBy: { sortOrder: 'asc' as const } },
  zones: true,
  tables: true,
  floorPlanElements: true,
};

@Injectable()
export class RestaurantsService {
  constructor(private prisma: PrismaService) {}

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
  async update(id: string, userRestaurantId: string | undefined, dto: any) {
    this.assertOwnership(id, userRestaurantId);
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
    return this.findOneForStaff(id);
  }

  /** Replace zones for a restaurant (used by builder/wizard). */
  async setZones(
    id: string,
    userRestaurantId: string | undefined,
    zones: { id?: string; name: string }[],
  ) {
    this.assertOwnership(id, userRestaurantId);
    await this.prisma.$transaction(async (tx) => {
      await tx.zone.deleteMany({ where: { restaurantId: id } });
      for (const z of zones) {
        await tx.zone.create({
          data: { id: z.id, restaurantId: id, name: z.name },
        });
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
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.table.findMany({
        where: { restaurantId: id },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((t) => t.id));
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
    return this.findOneForStaff(id);
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
    return {
      openingTime: r.openingTime,
      kitchenClosing: r.kitchenClosing,
      closingTime: r.closingTime,
      maxGuests: r.maxGuests,
      defaultDuration: rules.defaultDurationMinutes ?? 120,
      durationByGuests: rules.durationByGuests ?? [],
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
