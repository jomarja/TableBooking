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
  /** Optional minimum party size that can book this table (merged from
   *  resourceMeta). null/undefined means no minimum — even one guest can book. */
  minCapacity?: number | null;
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

export type ResourceMode = 'FLOOR_PLAN' | 'RESOURCE_LIST';
export interface ResourceMeta {
  name?: string;
  description?: string;
  /** Minimum party size that can book this resource. Omitted = no minimum. */
  minCapacity?: number;
}
export type FieldRequirement = 'hidden' | 'optional' | 'required';

export interface RequiredFieldsConfig {
  firstName?: FieldRequirement;
  lastName?: FieldRequirement;
  phone?: FieldRequirement;
  email?: FieldRequirement;
  address?: FieldRequirement;
  comments?: FieldRequirement;
}

export interface SameDayCutoff {
  mode: 'disabled' | 'time' | 'beforeClose';
  time?: string; // HH:mm (mode === 'time')
  hoursBeforeClose?: number; // mode === 'beforeClose'
}

export interface ReservationRules {
  defaultDurationMinutes: number;
  durationByGuests: { maxGuests: number; minutes: number }[];
  resourceMode?: ResourceMode;
  resourceMeta?: Record<string, ResourceMeta>;
  // Reservation Settings module (all migration-free, stored in this blob):
  intervalMinutes?: number;
  onlineEnabled?: boolean;
  waitingList?: boolean;
  minGroupSize?: number;
  maxGroupSize?: number;
  minLeadTimeMinutes?: number;
  maxBookingWindowDays?: number;
  sameDayCutoff?: SameDayCutoff;
  requiredFields?: RequiredFieldsConfig;
  applyRequiredToWalkins?: boolean;
  staffNotifyMode?: 'never' | 'always' | 'online' | 'large';
  largeGroupThreshold?: number;
  reservationNotice?: string;
  // When false/absent (default), reservations cannot be placed on a table
  // during a blocked period. Toggle on to let staff override.
  allowReservationsOverBlocks?: boolean;
}

export interface ConfirmationPolicy {
  autoConfirm: boolean;
  confirmationWindowMinutes?: number;
  approvalMode?: 'auto' | 'manual' | 'hybrid';
}

export interface CapacityRules {
  maxGuestsPerReservation: number;
  maxReservationsPerTimeSlot: number;
  maxGuestsPerInterval?: number;
  maxOnlineReservationsPerDay?: number;
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
  lastEditedBy?: string | null;
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
  pendingOnline: Reservation[];
  blockedToday: BlockedPeriod[];
  recentActivity: {
    id: string;
    action: string;
    user: string;
    timestamp: string;
    customer: string;
  }[];
}
