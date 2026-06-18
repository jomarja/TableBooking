/**
 * Maps Prisma rows to the JSON shapes the frontends consume.
 * Centralized so the customer app, portal, and admin all see consistent data,
 * and so customer-facing payloads never leak internal fields (e.g. staffNotes).
 */

export function serializeTable(t: any) {
  return {
    id: t.id,
    number: t.number,
    capacity: t.capacity,
    shape: t.shape,
    zoneId: t.zoneId ?? null,
    tags: t.tags ?? [],
    mergeGroup: t.mergeGroup ?? null,
    // rich, shared coordinate shape used by the floor-plan renderer
    position: { x: t.posX, y: t.posY },
    size: { width: t.width, height: t.height },
    rotation: t.rotation ?? 0,
  };
}

export function serializeElement(e: any) {
  return {
    id: e.id,
    type: e.type,
    position: { x: e.posX, y: e.posY },
    size: { width: e.width, height: e.height },
    rotation: e.rotation ?? 0,
    metadata: e.metadata ?? {},
  };
}

export function serializeImage(img: any) {
  return { id: img.id, url: img.url, type: img.type };
}

export function serializeMenuItem(m: any) {
  return {
    id: m.id,
    category: m.category,
    name: m.name,
    description: m.description ?? '',
    price: m.price,
    photo: m.photo ?? null,
    sortOrder: m.sortOrder ?? 0,
  };
}

export function serializeZone(z: any) {
  return { id: z.id, name: z.name };
}

/** Full restaurant shape (public + portal). Derives a `cover` + `image` for legacy markup. */
export function serializeRestaurant(r: any) {
  const images = (r.images ?? []).map(serializeImage);
  const cover =
    images.find((i: any) => i.type === 'COVER')?.url ||
    images[0]?.url ||
    null;
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    rating: r.rating,
    priceRange: r.priceRange,
    priceLevel: r.priceLevel,
    address: r.address,
    website: r.website,
    phone: r.phone,
    timezone: r.timezone,
    openingTime: r.openingTime,
    kitchenClosing: r.kitchenClosing,
    closingTime: r.closingTime,
    openingHours: r.openingHours ?? null,
    distance: r.distance,
    popular: r.popular,
    outdoorSeating: r.outdoorSeating,
    familyFriendly: r.familyFriendly,
    status: r.status,
    published: r.published,
    importSource: r.importSource,
    reservationRules: r.reservationRules ?? null,
    reservationConfirmationPolicy: r.reservationConfirmationPolicy ?? null,
    capacityRules: r.capacityRules ?? null,
    holidayClosures: r.holidayClosures ?? [],
    allowTableSelection: r.allowTableSelection,
    maxGuests: r.maxGuests,
    floorPlanBackground: r.floorPlanBackground ?? null,
    description: r.description ?? '',
    reviewCount: r.reviewCount ?? 0,
    googleSyncedAt: r.googleSyncedAt ?? null,
    restDays: r.restDays ?? [],
    cuisines: r.cuisines ?? [],
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    // legacy single-image fields kept so existing customer markup keeps working
    image: cover,
    cover,
    images,
    menu: (r.menu ?? []).map(serializeMenuItem),
    zones: (r.zones ?? []).map(serializeZone),
    tables: (r.tables ?? []).map(serializeTable),
    floorPlan: {
      background: r.floorPlanBackground ?? null,
      elements: (r.floorPlanElements ?? []).map(serializeElement),
    },
  };
}

/** Customer-safe reservation (no staffNotes). */
export function serializeReservationPublic(res: any) {
  return {
    id: res.id,
    restaurantId: res.restaurantId,
    tableId: res.tableId,
    date: res.date,
    startTime: res.startTime,
    endTime: res.endTime,
    guests: res.guests,
    status: res.status,
    source: res.source,
    channel: res.channel,
  };
}

/** Full reservation (staff/admin) including internal notes + relations. */
export function serializeReservationFull(res: any) {
  return {
    id: res.id,
    restaurantId: res.restaurantId,
    tableId: res.tableId,
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
    channel: res.channel,
    status: res.status,
    createdAt: res.createdAt,
    events: res.events ?? undefined,
  };
}

export function serializeBlockedPeriod(b: any) {
  return {
    id: b.id,
    restaurantId: b.restaurantId,
    scope: b.scope,
    tableIds: b.tableIds ?? [],
    zoneId: b.zoneId ?? null,
    type: b.type,
    date: b.date ?? null,
    recurrenceRule: b.recurrenceRule ?? null,
    startTime: b.startTime,
    endTime: b.endTime,
    reason: b.reason,
  };
}
