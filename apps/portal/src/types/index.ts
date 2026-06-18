export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED';

// How the booking reached the restaurant (editable by staff).
export type ReservationChannel = 'ONLINE' | 'PHONE' | 'WALK_IN';

export interface Zone {
  id: string;
  name: string;
}

export interface TableModel {
  id: string;
  number: number;
  capacity: number;
  shape: 'CIRCLE' | 'SQUARE' | 'RECT';
  zoneId: string | null;
  tags: string[];
  mergeGroup: string | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
}

export interface FloorElement {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  metadata: Record<string, unknown>;
}

export interface RestaurantImage {
  id: string;
  url: string;
  type: 'COVER' | 'INTERIOR' | 'TERRACE' | 'FOOD' | 'BAR';
}

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  description: string;
  price: string;
  photo: string | null;
  sortOrder: number;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  priceRange: string;
  priceLevel: number;
  address: string;
  website: string;
  phone: string;
  timezone: string;
  openingTime: string;
  kitchenClosing: string;
  closingTime: string;
  openingHours: Record<string, { open: string; close: string }> | null;
  status: 'PENDING' | 'APPROVED' | 'DISABLED';
  published: boolean;
  reservationRules: ReservationRules | null;
  reservationConfirmationPolicy: ConfirmationPolicy | null;
  capacityRules: CapacityRules | null;
  holidayClosures: { date: string; reason: string }[];
  allowTableSelection: boolean;
  maxGuests: number;
  floorPlanBackground: string | null;
  description: string;
  reviewCount: number;
  restDays: string[];
  cuisines: string[];
  lat: number | null;
  lng: number | null;
  image: string | null;
  cover: string | null;
  images: RestaurantImage[];
  menu: MenuItem[];
  zones: Zone[];
  tables: TableModel[];
  floorPlan: { background: string | null; elements: FloorElement[] };
}

export interface ReservationRules {
  defaultDurationMinutes: number;
  durationByGuests: { maxGuests: number; minutes: number }[];
}

export interface ConfirmationPolicy {
  autoConfirm: boolean;
  confirmationWindowMinutes?: number;
}

export interface CapacityRules {
  maxGuestsPerReservation: number;
  maxReservationsPerTimeSlot: number;
}

export interface Reservation {
  id: string;
  restaurantId: string;
  tableId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  guests: number;
  name: string;
  surname: string;
  phone: string;
  occasion: string | null;
  customerNotes: string | null;
  staffNotes: string | null;
  source: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  channel: ReservationChannel;
  status: ReservationStatus;
  createdAt: string;
}

export interface RecurrenceRule {
  freq: 'WEEKLY' | 'MONTHLY';
  byWeekday?: number;
  byMonthDay?: number;
  until?: string;
}

export interface BlockedPeriod {
  id: string;
  restaurantId: string;
  scope: 'TABLES' | 'ZONE';
  tableIds: string[];
  zoneId: string | null;
  type: 'SINGLE' | 'RECURRING';
  date: string | null;
  recurrenceRule: RecurrenceRule | null;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface Staff {
  id: string;
  email: string;
  name: string;
  restaurantId: string;
  firstLogin: boolean;
}

export interface DashboardSummary {
  date: string;
  stats: {
    todayReservations: number;
    expectedGuests: number;
    occupancy: number;
    upcomingArrivals: number;
    blockedPeriods: number;
    availableTables: number;
    totalTables: number;
  };
  todayReservations: Reservation[];
  upcomingReservations: Reservation[];
  blockedToday: BlockedPeriod[];
  recentActivity: {
    id: string;
    action: string;
    user: string;
    timestamp: string;
    customer: string;
  }[];
}
