/**
 * Canonical TableBooker seed dataset — 12 Tbilisi restaurants.
 *
 * COORDINATE CONVENTION (shared by the floor-plan renderer in both the
 * customer app and the portal builder):
 *   - All positions/sizes are in a 0..100 relative space over a fixed viewBox.
 *   - Table `position` is the table's CENTER; `size` is its width/height.
 *   - FloorPlanElement `position` is its TOP-LEFT corner; `size` is width/height.
 * The renderer maps 0..100 -> viewBox pixels. No second format exists.
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface SeedTable {
  id: string;
  number: number;
  capacity: number;
  shape: 'CIRCLE' | 'SQUARE' | 'RECT';
  zone: string; // zone name (resolved to zoneId at seed time)
  tags: string[];
  mergeGroup?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
}

export interface SeedElement {
  type:
    | 'window'
    | 'door'
    | 'wc'
    | 'kitchen'
    | 'ac'
    | 'bar'
    | 'wall'
    | 'plant'
    | 'terrace'
    | 'entrance';
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation?: number;
  label?: string;
}

export interface SeedReservation {
  tableNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  guests: number;
  name: string;
  surname: string;
  phone: string;
  occasion?: string;
  customerNotes?: string;
  staffNotes?: string;
  source: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'SEATED'
    | 'COMPLETED'
    | 'CANCELLED';
}

export interface SeedBlocked {
  scope: 'TABLES' | 'ZONE';
  tableNumbers?: number[];
  zone?: string;
  type: 'SINGLE' | 'RECURRING';
  date?: string;
  recurrenceRule?: {
    freq: 'WEEKLY' | 'MONTHLY';
    byWeekday?: number;
    byMonthDay?: number;
    until?: string;
  };
  startTime: string;
  endTime: string;
  reason: string;
}

export interface SeedRestaurant {
  slug: string;
  name: string;
  cuisine: string;
  rating: number;
  priceRange: string;
  priceLevel: number;
  address: string;
  website: string;
  phone: string;
  openingTime: string;
  kitchenClosing: string;
  closingTime: string;
  distance: number;
  popular: boolean;
  outdoorSeating: boolean;
  familyFriendly: boolean;
  status: 'PENDING' | 'APPROVED' | 'DISABLED';
  published: boolean;
  allowTableSelection: boolean;
  reservationConfirmationPolicy: { autoConfirm: boolean; confirmationWindowMinutes?: number };
  images: { url: string; type: 'COVER' | 'INTERIOR' | 'TERRACE' | 'FOOD' | 'BAR' }[];
  menu: { category: string; name: string; price: string }[];
  zones: string[];
  tables: SeedTable[];
  elements: SeedElement[];
  reservations: SeedReservation[];
  blocked: SeedBlocked[];
  floorPlanBackground?: string;
  holidayClosures: { date: string; reason: string }[];
  owner: { email: string; name: string; password: string; firstLogin: boolean };
}

// Dates are relative to "today" so the demo always has live data.
function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
const TODAY = isoDay(0);
const TOMORROW = isoDay(1);
const IN_TWO = isoDay(2);

const STD_HOURS = {
  mon: { open: '10:00', close: '23:00' },
  tue: { open: '10:00', close: '23:00' },
  wed: { open: '10:00', close: '23:00' },
  thu: { open: '10:00', close: '23:00' },
  fri: { open: '10:00', close: '00:00' },
  sat: { open: '10:00', close: '00:00' },
  sun: { open: '11:00', close: '23:00' },
};

export const reservationRulesDefault = {
  defaultDurationMinutes: 120,
  durationByGuests: [
    { maxGuests: 2, minutes: 90 },
    { maxGuests: 4, minutes: 120 },
    { maxGuests: 8, minutes: 180 },
    { maxGuests: 20, minutes: 210 },
  ],
};

export const capacityRulesDefault = {
  maxGuestsPerReservation: 20,
  maxReservationsPerTimeSlot: 15,
};

export const openingHoursDefault = STD_HOURS;

const TAG_POOL = ['near_window', 'quiet', 'near_terrace', 'near_bar', 'private'];

/**
 * Generates a standard floor-plan (walls/entrance/kitchen/wc/bar/windows/plants)
 * plus a set of tables laid across the given zones. Produces realistic variety
 * based on a numeric seed so the 12 restaurants differ.
 */
function buildLayout(
  seed: number,
  zones: string[],
  tableCount: number,
  outdoor: boolean,
): { tables: SeedTable[]; elements: SeedElement[] } {
  const elements: SeedElement[] = [
    { type: 'entrance', position: { x: 44, y: 92 }, size: { width: 12, height: 4 }, label: 'Entrance' },
    { type: 'kitchen', position: { x: 72, y: 4 }, size: { width: 26, height: 14 }, label: 'Kitchen' },
    { type: 'wc', position: { x: 2, y: 4 }, size: { width: 12, height: 9 }, label: 'WC' },
    { type: 'bar', position: { x: 30, y: 70 }, size: { width: 26, height: 14 }, label: 'Bar' },
    { type: 'ac', position: { x: 50, y: 3 }, size: { width: 6, height: 3 }, label: 'AC' },
    { type: 'plant', position: { x: 6, y: 84 }, size: { width: 5, height: 5 }, label: 'Plant' },
    { type: 'plant', position: { x: 90, y: 60 }, size: { width: 5, height: 5 }, label: 'Plant' },
    // Windows along the left wall
    { type: 'window', position: { x: 0.5, y: 22 }, size: { width: 1.5, height: 10 } },
    { type: 'window', position: { x: 0.5, y: 38 }, size: { width: 1.5, height: 10 } },
    { type: 'window', position: { x: 0.5, y: 54 }, size: { width: 1.5, height: 10 } },
  ];
  if (outdoor) {
    elements.push({
      type: 'terrace',
      position: { x: 58, y: 66 },
      size: { width: 40, height: 28 },
      label: 'Terrace',
    });
  }

  const tables: SeedTable[] = [];
  // Capacity pattern varies by seed for variety.
  const capacityPatterns = [
    [2, 2, 4, 4, 6, 2, 4, 6, 8, 2, 4, 10],
    [2, 4, 4, 6, 2, 2, 8, 4, 6, 10, 2, 4],
    [4, 4, 2, 6, 8, 2, 4, 2, 6, 4, 12, 2],
  ];
  const pattern = capacityPatterns[seed % capacityPatterns.length];

  // Lay tables in a grid in the central dining area (x 14..66, y 18..62),
  // with overflow placed in the terrace / window zones.
  const cols = 4;
  for (let i = 0; i < tableCount; i++) {
    const cap = pattern[i % pattern.length];
    const col = i % cols;
    const row = Math.floor(i / cols);
    let x = 16 + col * 16;
    let y = 22 + row * 16;
    let zone = zones[Math.min(row, zones.length - 1)] || zones[0];

    // Push some tables into terrace zone if available.
    if (outdoor && zones.includes('Terrace') && i >= tableCount - 3) {
      zone = 'Terrace';
      x = 64 + (i % 3) * 11;
      y = 74 + Math.floor((i % 6) / 3) * 10;
    }

    const shape: SeedTable['shape'] =
      cap <= 2 ? 'CIRCLE' : cap <= 4 ? 'SQUARE' : 'RECT';
    const size =
      shape === 'CIRCLE'
        ? { width: 7, height: 7 }
        : shape === 'SQUARE'
          ? { width: 9, height: 9 }
          : { width: 14, height: 9 };

    const tags: string[] = [];
    if (col === 0) tags.push('near_window');
    if (zone === 'Terrace') tags.push('near_terrace');
    if (zone === 'Bar Area') tags.push('near_bar');
    if (zone === 'VIP') tags.push('private', 'quiet');
    if (cap >= 8) tags.push('private');
    // ensure at least one tag
    if (!tags.length) tags.push(TAG_POOL[(seed + i) % TAG_POOL.length]);

    tables.push({
      id: '',
      number: i + 1,
      capacity: cap,
      shape,
      zone,
      tags: Array.from(new Set(tags)),
      position: { x, y },
      size,
      rotation: 0,
    });
  }

  // Add a mergeGroup pairing on two adjacent 4-seat tables (Table 3 + 4) where possible.
  const t3 = tables.find((t) => t.number === 3);
  const t4 = tables.find((t) => t.number === 4);
  if (t3 && t4) {
    t3.mergeGroup = 'A';
    t4.mergeGroup = 'A';
  }

  return { tables, elements };
}

// Floor-plan elements get table elements appended at seed time (linking by tableId),
// so seed-data only defines the static decor elements above.

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/${id}?w=900&h=600&fit=crop`;

function stdImages(cover: string, interior: string, food: string): SeedRestaurant['images'] {
  return [
    { url: UNSPLASH(cover), type: 'COVER' },
    { url: UNSPLASH(interior), type: 'INTERIOR' },
    { url: UNSPLASH(food), type: 'FOOD' },
  ];
}

function georgianMenu(): SeedRestaurant['menu'] {
  return [
    { category: 'Cold Starters', name: 'Pkhali (spinach & walnut)', price: '₾12' },
    { category: 'Cold Starters', name: 'Badrijani Nigvzit', price: '₾14' },
    { category: 'Hot Starters', name: 'Khinkali (5 pcs)', price: '₾10' },
    { category: 'Hot Starters', name: 'Khachapuri Imeruli', price: '₾16' },
    { category: 'Hot Starters', name: 'Adjaruli Khachapuri', price: '₾20' },
    { category: 'Main Course', name: 'Mtsvadi (pork skewers)', price: '₾28' },
    { category: 'Main Course', name: 'Chakhokhbili', price: '₾26' },
    { category: 'Main Course', name: 'Ojakhuri', price: '₾30' },
    { category: 'Desserts', name: 'Churchkhela', price: '₾8' },
    { category: 'Desserts', name: 'Pelamushi', price: '₾9' },
    { category: 'Drinks', name: 'Saperavi (glass)', price: '₾12' },
    { category: 'Drinks', name: 'Borjomi', price: '₾5' },
  ];
}

interface RestaurantSpec {
  slug: string;
  name: string;
  cuisine: string;
  rating: number;
  priceRange: string;
  priceLevel: number;
  address: string;
  distance: number;
  popular: boolean;
  outdoor: boolean;
  family: boolean;
  open: string;
  kitchen: string;
  close: string;
  status: SeedRestaurant['status'];
  published: boolean;
  allowTableSelection: boolean;
  autoConfirm: boolean;
  images: SeedRestaurant['images'];
  zones: string[];
  tableCount: number;
  background?: string;
}

const SPECS: RestaurantSpec[] = [
  {
    slug: 'shavi-lomi', name: 'Shavi Lomi', cuisine: 'georgian', rating: 4.8,
    priceRange: '₾40-₾80', priceLevel: 2, address: '28 Zubalashvili St, Tbilisi',
    distance: 1.2, popular: true, outdoor: true, family: true,
    open: '12:00', kitchen: '23:00', close: '00:00', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: true,
    images: stdImages('photo-1517248135467-4c7edcad34c4', 'photo-1555396273-367ea4eb4db5', 'photo-1414235077428-338989a2e8c0'),
    zones: ['Indoor', 'Window', 'Bar Area', 'Terrace'], tableCount: 12,
    background: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop',
  },
  {
    slug: 'barbarestan', name: 'Barbarestan', cuisine: 'georgian', rating: 4.9,
    priceRange: '₾60-₾120', priceLevel: 3, address: '132 Davit Aghmashenebeli Ave, Tbilisi',
    distance: 2.1, popular: true, outdoor: false, family: false,
    open: '13:00', kitchen: '22:30', close: '23:30', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: false,
    images: stdImages('photo-1559339352-11d035aa65de', 'photo-1424847651672-bf20a4b0982b', 'photo-1504674900247-0877df9cc836'),
    zones: ['Indoor', 'VIP', 'Window'], tableCount: 10,
  },
  {
    slug: 'cafe-littera', name: 'Café Littera', cuisine: 'georgian', rating: 4.7,
    priceRange: '₾50-₾100', priceLevel: 3, address: '13 Ivane Machabeli St, Tbilisi',
    distance: 1.8, popular: true, outdoor: true, family: true,
    open: '12:00', kitchen: '23:00', close: '23:30', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: true,
    images: stdImages('photo-1466978913421-dad2ebd01d17', 'photo-1592861956120-e524fc739696', 'photo-1540189549336-e6e99c3679fe'),
    zones: ['Indoor', 'Terrace', 'Window'], tableCount: 11,
  },
  {
    slug: 'funicular', name: 'Funicular Complex', cuisine: 'georgian', rating: 4.5,
    priceRange: '₾45-₾90', priceLevel: 2, address: 'Mtatsminda Park, Tbilisi',
    distance: 3.4, popular: true, outdoor: true, family: true,
    open: '11:00', kitchen: '23:30', close: '00:00', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: true,
    images: stdImages('photo-1552566626-52f8b828add9', 'photo-1559339352-11d035aa65de', 'photo-1432139555190-58524dae6a55'),
    zones: ['Indoor', 'Terrace', 'VIP', 'Window'], tableCount: 12,
  },
  {
    slug: 'salobie-bia', name: 'Salobie Bia', cuisine: 'georgian', rating: 4.6,
    priceRange: '₾35-₾70', priceLevel: 2, address: '14 Egnate Ninoshvili St, Tbilisi',
    distance: 2.7, popular: false, outdoor: false, family: true,
    open: '11:00', kitchen: '22:00', close: '23:00', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: true,
    images: stdImages('photo-1525648199074-cee30ba79a4a', 'photo-1555992336-fb0d29498b13', 'photo-1473093295043-cdd812d0e601'),
    zones: ['Indoor', 'Window'], tableCount: 9,
  },
  {
    slug: 'azarphesha', name: 'Azarphesha', cuisine: 'georgian', rating: 4.8,
    priceRange: '₾55-₾110', priceLevel: 3, address: '2 Pavle Ingorokva St, Tbilisi',
    distance: 1.5, popular: true, outdoor: false, family: false,
    open: '12:00', kitchen: '22:30', close: '23:30', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: false,
    images: stdImages('photo-1544025162-d76694265947', 'photo-1414235077428-338989a2e8c0', 'photo-1504674900247-0877df9cc836'),
    zones: ['Indoor', 'VIP', 'Bar Area'], tableCount: 10,
  },
  {
    slug: 'keto-kote', name: 'Keto and Kote', cuisine: 'georgian', rating: 4.7,
    priceRange: '₾50-₾95', priceLevel: 3, address: '3 Zandukeli Dead End, Tbilisi',
    distance: 2.0, popular: true, outdoor: true, family: true,
    open: '13:00', kitchen: '23:00', close: '00:00', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: true,
    images: stdImages('photo-1592861956120-e524fc739696', 'photo-1466978913421-dad2ebd01d17', 'photo-1540189549336-e6e99c3679fe'),
    zones: ['Indoor', 'Terrace', 'Window', 'VIP'], tableCount: 12,
  },
  {
    slug: 'tsiskvili', name: 'Tsiskvili', cuisine: 'georgian', rating: 4.4,
    priceRange: '₾40-₾85', priceLevel: 2, address: '3 Tbilisi-Tianeti Hwy, Tbilisi',
    distance: 5.5, popular: false, outdoor: true, family: true,
    open: '11:00', kitchen: '23:30', close: '00:30', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: true,
    images: stdImages('photo-1473093295043-cdd812d0e601', 'photo-1555992336-fb0d29498b13', 'photo-1414235077428-338989a2e8c0'),
    zones: ['Indoor', 'Terrace', 'Window'], tableCount: 12,
  },
  {
    slug: 'maspindzelo', name: 'Maspindzelo', cuisine: 'georgian', rating: 4.3,
    priceRange: '₾30-₾65', priceLevel: 2, address: '7 Marjanishvili St, Tbilisi',
    distance: 2.3, popular: false, outdoor: true, family: true,
    open: '10:00', kitchen: '23:00', close: '23:59', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: true,
    images: stdImages('photo-1555396273-367ea4eb4db5', 'photo-1517248135467-4c7edcad34c4', 'photo-1540189549336-e6e99c3679fe'),
    zones: ['Indoor', 'Terrace', 'Window', 'Bar Area'], tableCount: 11,
  },
  {
    slug: 'sormoni', name: 'Sormoni', cuisine: 'seafood', rating: 4.6,
    priceRange: '₾60-₾130', priceLevel: 3, address: '21 Petre Kavtaradze St, Tbilisi',
    distance: 3.1, popular: true, outdoor: false, family: false,
    open: '12:00', kitchen: '23:00', close: '00:00', status: 'APPROVED', published: true,
    allowTableSelection: false, autoConfirm: true,
    images: stdImages('photo-1559339352-11d035aa65de', 'photo-1424847651672-bf20a4b0982b', 'photo-1504674900247-0877df9cc836'),
    zones: ['Indoor', 'VIP', 'Window'], tableCount: 10,
  },
  {
    slug: 'mukha', name: 'Mukha', cuisine: 'asian', rating: 4.5,
    priceRange: '₾35-₾75', priceLevel: 2, address: '5 Akhvlediani St, Tbilisi',
    distance: 1.1, popular: true, outdoor: true, family: true,
    open: '11:00', kitchen: '22:30', close: '23:30', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: true,
    images: stdImages('photo-1525648199074-cee30ba79a4a', 'photo-1552566626-52f8b828add9', 'photo-1473093295043-cdd812d0e601'),
    zones: ['Indoor', 'Terrace', 'Bar Area'], tableCount: 11,
  },
  {
    slug: 'poliphonia', name: 'Poliphonia', cuisine: 'georgian', rating: 4.9,
    priceRange: '₾70-₾140', priceLevel: 4, address: '34 Lado Asatiani St, Tbilisi',
    distance: 1.9, popular: true, outdoor: false, family: false,
    open: '18:00', kitchen: '23:30', close: '01:00', status: 'APPROVED', published: true,
    allowTableSelection: true, autoConfirm: false,
    images: stdImages('photo-1544025162-d76694265947', 'photo-1592861956120-e524fc739696', 'photo-1540189549336-e6e99c3679fe'),
    zones: ['Indoor', 'VIP', 'Bar Area', 'Window'], tableCount: 10,
  },
];

const FIRST_NAMES = ['Giorgi', 'Nino', 'Davit', 'Mariam', 'Luka', 'Tamar', 'Saba', 'Ana', 'Nika', 'Elene'];
const LAST_NAMES = ['Beridze', 'Kapanadze', 'Lomidze', 'Gelashvili', 'Maisuradze', 'Tsiklauri', 'Kvaratskhelia'];
const OCCASIONS = ['Birthday', 'Anniversary', 'Business Meeting', 'Date Night', 'Graduation', undefined];
const STAFF_NOTES = ['VIP customer', 'Window seat preferred', 'Manager approval needed', undefined, undefined];

/** Builds 3-5 reservations for a restaurant across today/tomorrow with varied statuses. */
function buildReservations(seed: number, tableCount: number): SeedReservation[] {
  const count = 3 + (seed % 3); // 3..5
  const statuses: SeedReservation['status'][] = [
    'CONFIRMED', 'SEATED', 'COMPLETED', 'PENDING', 'CONFIRMED',
  ];
  const slots = ['12:30', '14:00', '18:00', '19:30', '20:30'];
  const dates = [TODAY, TODAY, TOMORROW, IN_TWO, TODAY];
  const res: SeedReservation[] = [];
  for (let i = 0; i < count; i++) {
    const tableNumber = ((seed + i * 3) % tableCount) + 1;
    const start = slots[(seed + i) % slots.length];
    const [h, m] = start.split(':').map(Number);
    const endH = (h + 2) % 24;
    const end = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const guests = [2, 2, 4, 6, 3][(seed + i) % 5];
    res.push({
      tableNumber,
      date: dates[(seed + i) % dates.length],
      startTime: start,
      endTime: end,
      guests,
      name: FIRST_NAMES[(seed + i) % FIRST_NAMES.length],
      surname: LAST_NAMES[(seed + i) % LAST_NAMES.length],
      phone: `+9955${String(50000000 + seed * 137 + i * 911).slice(0, 8)}`,
      occasion: OCCASIONS[(seed + i) % OCCASIONS.length],
      customerNotes: i % 2 === 0 ? 'Please prepare a quiet table' : undefined,
      staffNotes: STAFF_NOTES[(seed + i) % STAFF_NOTES.length],
      source: i % 4 === 0 ? 'STAFF' : 'CUSTOMER',
      status: statuses[(seed + i) % statuses.length],
    });
  }
  return res;
}

/** Builds 1-2 blocked periods, at least one recurring across the dataset. */
function buildBlocked(seed: number, zones: string[], tableCount: number): SeedBlocked[] {
  const reasons = ['Private Event', 'Wedding', 'Cleaning', 'Maintenance', 'Staff Meeting'];
  const blocks: SeedBlocked[] = [];
  // One single block today/tomorrow on a couple of tables.
  blocks.push({
    scope: 'TABLES',
    tableNumbers: [((seed) % tableCount) + 1, ((seed + 1) % tableCount) + 1],
    type: 'SINGLE',
    date: seed % 2 === 0 ? TODAY : TOMORROW,
    startTime: '17:00',
    endTime: '20:00',
    reason: reasons[seed % reasons.length],
  });
  // Every other restaurant gets a recurring block; alternate weekly/zone vs monthly.
  if (seed % 2 === 0) {
    blocks.push({
      scope: zones.includes('Terrace') ? 'ZONE' : 'TABLES',
      zone: zones.includes('Terrace') ? 'Terrace' : undefined,
      tableNumbers: zones.includes('Terrace') ? undefined : [tableCount],
      type: 'RECURRING',
      recurrenceRule: { freq: 'WEEKLY', byWeekday: 1 }, // every Monday
      startTime: '10:00',
      endTime: '14:00',
      reason: 'Staff Meeting',
    });
  } else {
    blocks.push({
      scope: 'TABLES',
      tableNumbers: [1],
      type: 'RECURRING',
      recurrenceRule: { freq: 'WEEKLY', byWeekday: 5 }, // every Friday
      startTime: '18:00',
      endTime: '20:00',
      reason: 'Private Event',
    });
  }
  return blocks;
}

export const seedRestaurants: SeedRestaurant[] = SPECS.map((s, idx) => {
  const { tables, elements } = buildLayout(idx, s.zones, s.tableCount, s.outdoor);
  return {
    slug: s.slug,
    name: s.name,
    cuisine: s.cuisine,
    rating: s.rating,
    priceRange: s.priceRange,
    priceLevel: s.priceLevel,
    address: s.address,
    website: `www.${s.slug.replace(/-/g, '')}.ge`,
    phone: `+995 555 ${String(100 + idx)} ${String(200 + idx * 3)}`,
    openingTime: s.open,
    kitchenClosing: s.kitchen,
    closingTime: s.close,
    distance: s.distance,
    popular: s.popular,
    outdoorSeating: s.outdoor,
    familyFriendly: s.family,
    status: s.status,
    published: s.published,
    allowTableSelection: s.allowTableSelection,
    reservationConfirmationPolicy: s.autoConfirm
      ? { autoConfirm: true }
      : { autoConfirm: false, confirmationWindowMinutes: 15 },
    images: s.images,
    menu: georgianMenu(),
    zones: s.zones,
    tables,
    elements,
    reservations: buildReservations(idx, s.tableCount),
    blocked: buildBlocked(idx, s.zones, s.tableCount),
    floorPlanBackground: s.background,
    holidayClosures: [
      { date: `${new Date().getFullYear()}-12-31`, reason: 'New Year Event' },
      { date: `${new Date().getFullYear() + 1}-01-01`, reason: 'New Year Holiday' },
    ],
    owner: {
      email: `owner@${s.slug.replace(/-/g, '')}.ge`,
      name: `${s.name} Owner`,
      password: 'password',
      // The 12 published restaurants have completed setup. A dedicated
      // pending "Demo Bistro" (added in the seed script) demos first-login.
      firstLogin: false,
    },
  };
});

// A pending + a disabled extra restaurant to exercise the admin console
// without affecting the 12 published ones above.
export const extraRestaurants: { spec: Partial<SeedRestaurant>; status: SeedRestaurant['status'] }[] = [];

export const seedAdmin = {
  email: 'admin@tablebooker.ge',
  name: 'Platform Admin',
  password: 'admin',
};
