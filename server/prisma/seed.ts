/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  seedRestaurants,
  seedAdmin,
  reservationRulesDefault,
  capacityRulesDefault,
  openingHoursDefault,
  SeedRestaurant,
} from '../../shared/seed-data';

const prisma = new PrismaClient();

async function createRestaurant(r: SeedRestaurant) {
  const passwordHash = await bcrypt.hash(r.owner.password, 10);

  const restaurant = await prisma.restaurant.create({
    data: {
      name: r.name,
      cuisine: r.cuisine,
      rating: r.rating,
      priceRange: r.priceRange,
      priceLevel: r.priceLevel,
      address: r.address,
      website: r.website,
      phone: r.phone,
      openingTime: r.openingTime,
      kitchenClosing: r.kitchenClosing,
      closingTime: r.closingTime,
      openingHours: openingHoursDefault,
      distance: r.distance,
      popular: r.popular,
      outdoorSeating: r.outdoorSeating,
      familyFriendly: r.familyFriendly,
      status: r.status,
      published: r.published,
      reservationRules: reservationRulesDefault,
      reservationConfirmationPolicy: r.reservationConfirmationPolicy,
      capacityRules: capacityRulesDefault,
      holidayClosures: r.holidayClosures,
      allowTableSelection: r.allowTableSelection,
      maxGuests: 20,
      floorPlanBackground: r.floorPlanBackground ?? null,
      images: {
        create: r.images.map((img, i) => ({
          url: img.url,
          type: img.type,
          sortOrder: i,
        })),
      },
      menu: {
        create: r.menu.map((m, i) => ({
          category: m.category,
          name: m.name,
          price: m.price,
          sortOrder: i,
        })),
      },
      staff: {
        create: {
          email: r.owner.email,
          name: r.owner.name,
          passwordHash,
          firstLogin: r.owner.firstLogin,
        },
      },
    },
  });

  // Zones (name -> id)
  const zoneIdByName = new Map<string, string>();
  for (const name of r.zones) {
    const z = await prisma.zone.create({
      data: { restaurantId: restaurant.id, name },
    });
    zoneIdByName.set(name, z.id);
  }

  // Tables (number -> id), plus a linked floor-plan element per table.
  const tableIdByNumber = new Map<number, string>();
  for (const t of r.tables) {
    const created = await prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        number: t.number,
        capacity: t.capacity,
        shape: t.shape,
        zoneId: zoneIdByName.get(t.zone) ?? null,
        tags: t.tags,
        mergeGroup: t.mergeGroup ?? null,
        posX: t.position.x,
        posY: t.position.y,
        width: t.size.width,
        height: t.size.height,
        rotation: t.rotation,
      },
    });
    tableIdByNumber.set(t.number, created.id);

    // Floor-plan element for the table (top-left from center).
    await prisma.floorPlanElement.create({
      data: {
        restaurantId: restaurant.id,
        type: 'table',
        posX: t.position.x - t.size.width / 2,
        posY: t.position.y - t.size.height / 2,
        width: t.size.width,
        height: t.size.height,
        rotation: t.rotation,
        metadata: { tableId: created.id, number: t.number },
      },
    });
  }

  // Static decor elements.
  for (const e of r.elements) {
    await prisma.floorPlanElement.create({
      data: {
        restaurantId: restaurant.id,
        type: e.type,
        posX: e.position.x,
        posY: e.position.y,
        width: e.size.width,
        height: e.size.height,
        rotation: e.rotation ?? 0,
        metadata: e.label ? { label: e.label } : {},
      },
    });
  }

  // Reservations (+ a created event each).
  for (const res of r.reservations) {
    await prisma.reservation.create({
      data: {
        restaurantId: restaurant.id,
        tableId: tableIdByNumber.get(res.tableNumber) ?? null,
        date: res.date,
        startTime: res.startTime,
        endTime: res.endTime,
        guests: res.guests,
        name: res.name,
        surname: res.surname,
        phone: res.phone,
        occasion: res.occasion ?? null,
        customerNotes: res.customerNotes ?? null,
        staffNotes: res.staffNotes ?? null,
        source: res.source,
        // Derive a booking channel: self-service customers came in online,
        // anything staff/admin entered is treated as a walk-in by default.
        channel: (res as any).channel ?? (res.source === 'CUSTOMER' ? 'ONLINE' : 'WALK_IN'),
        status: res.status,
        events: {
          create: { action: 'created', user: res.source.toLowerCase() },
        },
      },
    });
  }

  // Blocked periods (resolve table numbers -> ids).
  for (const b of r.blocked) {
    await prisma.blockedPeriod.create({
      data: {
        restaurantId: restaurant.id,
        scope: b.scope,
        tableIds: (b.tableNumbers ?? [])
          .map((n) => tableIdByNumber.get(n))
          .filter((x): x is string => Boolean(x)),
        zoneId: b.zone ? (zoneIdByName.get(b.zone) ?? null) : null,
        type: b.type,
        date: b.date ?? null,
        recurrenceRule: b.recurrenceRule ?? undefined,
        startTime: b.startTime,
        endTime: b.endTime,
        reason: b.reason,
      },
    });
  }

  console.log(`  ✓ ${r.name} (${r.tables.length} tables, ${r.reservations.length} reservations)`);
  return restaurant;
}

async function main() {
  const existing = await prisma.restaurant.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} restaurants — skipping seed.`);
    return;
  }

  console.log('Seeding admin...');
  await prisma.admin.create({
    data: {
      email: seedAdmin.email,
      name: seedAdmin.name,
      passwordHash: await bcrypt.hash(seedAdmin.password, 10),
    },
  });

  console.log('Seeding restaurants...');
  for (const r of seedRestaurants) {
    await createRestaurant(r);
  }

  // A dedicated PENDING restaurant in first-login mode to demo the
  // setup wizard + admin approval flow.
  console.log('Seeding demo (pending) restaurant for wizard...');
  await prisma.restaurant.create({
    data: {
      name: 'Demo Bistro',
      cuisine: 'georgian',
      address: '',
      status: 'PENDING',
      published: false,
      reservationRules: reservationRulesDefault,
      reservationConfirmationPolicy: { autoConfirm: true },
      capacityRules: capacityRulesDefault,
      holidayClosures: [],
      staff: {
        create: {
          email: 'owner@demobistro.ge',
          name: 'Demo Owner',
          passwordHash: await bcrypt.hash('password', 10),
          firstLogin: true,
        },
      },
    },
  });

  const counts = {
    restaurants: await prisma.restaurant.count(),
    staff: await prisma.staff.count(),
    tables: await prisma.table.count(),
    reservations: await prisma.reservation.count(),
    blocked: await prisma.blockedPeriod.count(),
  };
  console.log('Done:', counts);
  console.log('\nLogins:');
  console.log('  Admin:  admin@tablebooker.ge / admin');
  console.log('  Staff:  owner@shavilomi.ge / password  (and owner@<slug>.ge)');
  console.log('  Wizard: owner@demobistro.ge / password  (first login)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
