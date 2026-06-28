import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Calendar from 'react-calendar';
import {
  FiStar,
  FiMapPin,
  FiPhone,
  FiGlobe,
  FiClock,
  FiAlertTriangle,
  FiX,
  FiNavigation,
  FiBookOpen,
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiCalendar,
} from 'react-icons/fi';
import { FloorPlanCanvas } from '@shared/floorplan/index.js';
import StepIndicator from '../components/StepIndicator';
import { useReservation } from '../context/ReservationContext';
import { api } from '../api/client';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Compact date for the inline navigator, e.g. "Sun, Jun 28, 2026".
function formatDateMedium(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Group flat menu items (from API) into category sections for the modal.
function groupMenu(menu) {
  if (!menu || !menu.length) return [];
  const map = new Map();
  for (const item of menu) {
    const cat = item.category || 'Menu';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(item);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

function computeDuration(guestCount, durationByGuests, defaultDuration) {
  if (!guestCount) return defaultDuration;
  const sorted = [...durationByGuests].sort((a, b) => a.maxGuests - b.maxGuests);
  for (const r of sorted) {
    if (guestCount <= r.maxGuests) return r.minutes;
  }
  return defaultDuration;
}

function weekdayName(ds) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
}

// Turn a day's status + reason (from the availability engine) into specific,
// friendly copy. `info` = { status, reason }. Covers every unavailable case so
// the customer always sees WHY a day can't be booked.
function describeUnavailableDay(ds, info, holidayClosures) {
  const reason = info?.reason;
  const wd = weekdayName(ds);
  if (info?.status === 'closed') {
    if (reason === 'holiday') {
      const h = (holidayClosures || []).find((x) => x.date === ds);
      return {
        emoji: '🎉',
        title: 'Closed for a holiday',
        message: h?.reason
          ? `The restaurant is closed for ${h.reason}.`
          : 'The restaurant is closed on this date for a holiday.',
      };
    }
    if (reason === 'rest_day') {
      return {
        emoji: '🗓️',
        title: `Closed on ${wd}s`,
        message: `This restaurant is closed every ${wd}. Please pick another day.`,
      };
    }
    if (reason === 'no_tables') {
      return {
        emoji: '🪑',
        title: 'Not bookable online yet',
        message:
          "This restaurant hasn't set up tables for online reservations yet. Please contact them directly.",
      };
    }
    return { emoji: '🚪', title: 'Closed', message: 'The restaurant is closed on this day.' };
  }
  if (info?.status === 'fully_booked') {
    if (reason === 'no_table_for_party') {
      return {
        emoji: '👥',
        title: 'No table for this group',
        message: 'No table can seat this party on this day. Try fewer guests or another day.',
      };
    }
    return {
      emoji: '📅',
      title: 'Fully booked',
      message:
        'Every table is already reserved for this day. Try a nearby day or the next available time below.',
    };
  }
  return { emoji: '⛔', title: 'Unavailable', message: 'No bookings are available for this day.' };
}

export default function RestaurantPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateReservation } = useReservation();
  const stepContainerRef = useRef(null);

  const [restaurant, setRestaurant] = useState(null);
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeStep, setActiveStep] = useState('date');
  const [selectedDate, setSelectedDate] = useState(null);
  const [guestCount, setGuestCount] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [, setSelectedTime] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [pendingTime, setPendingTime] = useState(null);
  const [hoveredTable, setHoveredTable] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [availability, setAvailability] = useState(null);
  // Per-day status for the calendar (date -> 'available'|'limited'|'fully_booked'|'closed')
  const [calendarStatus, setCalendarStatus] = useState({});
  const [nextAvail, setNextAvail] = useState(null);

  // Load restaurant + reservation config.
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.getRestaurant(id), api.getReservationConfig(id)])
      .then(([r, c]) => {
        if (!active) return;
        setRestaurant(r);
        setConfig(c);
        setLoadError(null);
      })
      .catch((e) => active && setLoadError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (stepContainerRef.current) {
      stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeStep]);

  // Load per-day availability for the calendar (a ~6-week window), so days are
  // colour-coded before the customer ever clicks. Refetched on month change.
  const loadCalendar = (fromDate) => {
    const from = formatDateString(fromDate);
    const toD = new Date(fromDate);
    toD.setDate(toD.getDate() + 45);
    api
      .availabilityCalendar(id, from, formatDateString(toD))
      .then((m) => setCalendarStatus((prev) => ({ ...prev, ...m })))
      .catch(() => {});
  };
  useEffect(() => {
    if (id) loadCalendar(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const currentStep = useMemo(() => {
    switch (activeStep) {
      case 'date': return selectedDate ? 3 : 2;
      case 'guests': return 3;
      case 'table': return 4;
      case 'time': return 5;
      default: return 2;
    }
  }, [activeStep, selectedDate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading restaurant…</div>
      </div>
    );
  }

  if (loadError || !restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <p className="text-xl text-gray-600">Restaurant not found.</p>
        {loadError && <p className="text-sm text-gray-400">{loadError}</p>}
        <button
          onClick={() => navigate('/restaurants')}
          className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
        >
          Back to restaurants
        </button>
      </div>
    );
  }

  // In Resource List mode there's no floor plan, so customers never pick a
  // specific resource — staff assign it later. Otherwise honour the setting.
  const resourceMode = restaurant?.reservationRules?.resourceMode;
  const allowTableSelection =
    resourceMode !== 'RESOURCE_LIST' && config?.allowTableSelection !== false;

  const openingMinutes = parseTime(restaurant.openingTime);
  const kitchenClosingMinutes = parseTime(restaurant.kitchenClosing);
  let closingMinutes = parseTime(restaurant.closingTime);
  if (closingMinutes <= openingMinutes) closingMinutes += 24 * 60;

  const images = restaurant.images?.length
    ? restaurant.images
    : [{ id: 'cover', url: restaurant.image, type: 'COVER' }];

  const reservations = availability?.reservations || [];
  const blockedPeriods = availability?.blockedPeriods || [];
  const tables = restaurant.tables || [];

  const holidayClosures = config?.holidayClosures || [];
  const durationByGuests = config?.durationByGuests || [];
  const defaultDuration = config?.defaultDuration || 120; // matches server default
  const suggestedDuration = computeDuration(guestCount, durationByGuests, defaultDuration);

  // ----- Reservation settings reflected from the portal config -----
  const onlineEnabled = config?.onlineEnabled !== false;
  const slotStep = config?.intervalMinutes || 30; // time-grid granularity (matches server default)
  const leadMinutes = config?.minLeadTimeMinutes || 0;
  const maxWindowDays = config?.maxBookingWindowDays || 0;
  const maxBookingDate =
    maxWindowDays > 0
      ? (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() + maxWindowDays);
          return d;
        })()
      : null;
  // For today, enforce lead time + same-day cutoff so a customer can't pick a
  // slot the server would reject. earliestStart = first bookable minute today
  // (Infinity = same-day booking is closed entirely).
  const isToday =
    !!selectedDate && formatDateString(selectedDate) === formatDateString(new Date());
  let earliestStart = -Infinity;
  if (isToday) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    earliestStart = nowMinutes + leadMinutes;
    const cutoff = config?.sameDayCutoff;
    if (cutoff && cutoff.mode && cutoff.mode !== 'disabled') {
      if (cutoff.mode === 'time' && cutoff.time && nowMinutes >= parseTime(cutoff.time)) {
        earliestStart = Infinity;
      } else if (
        cutoff.mode === 'beforeClose' &&
        nowMinutes >= closingMinutes - (cutoff.hoursBeforeClose || 0) * 60
      ) {
        earliestStart = Infinity;
      }
    }
  }

  // Reservations + blocked periods for a table, treated identically (un-bookable).
  const tableBusyIntervals = (tableId) => {
    const intervals = [];
    for (const r of reservations) {
      if (r.tableId === tableId) intervals.push({ start: r.startTime, end: r.endTime });
    }
    for (const b of blockedPeriods) {
      if ((b.tableIds || []).includes(tableId)) {
        intervals.push({ start: b.startTime, end: b.endTime });
      }
    }
    return intervals;
  };

  const tableReservations = selectedTable ? tableBusyIntervals(selectedTable.id) : [];

  const getTableStatus = (table) => {
    if (!guestCount) return 'disabled';
    // A table fits when minCapacity <= party <= capacity. No minCapacity set
    // means a floor of 1, so even a single guest can book it.
    const minCap = table.minCapacity || 1;
    if (guestCount < minCap) return 'disabled'; // party too small for this table
    if (guestCount > table.capacity) return 'disabled'; // party too large

    const busy = tableBusyIntervals(table.id);
    if (busy.length > 0) {
      const sorted = [...busy].sort((a, b) => parseTime(a.start) - parseTime(b.start));
      let coveredFrom = openingMinutes;
      for (const iv of sorted) {
        let s = parseTime(iv.start);
        let e = parseTime(iv.end);
        if (e <= openingMinutes) e += 24 * 60;
        if (s <= openingMinutes) s = openingMinutes;
        if (s <= coveredFrom) coveredFrom = Math.max(coveredFrom, e);
      }
      if (coveredFrom >= closingMinutes) return 'occupied';
    }

    if (selectedTable && selectedTable.id === table.id) return 'selected';
    return 'available';
  };

  // keepGuests=true preserves the chosen party size and jumps straight to the
  // table/time step (used by the inline date navigator), so changing the date
  // doesn't force the diner to re-pick guests.
  // Decide the step + load data for a chosen day, given its known status.
  const routeForDay = (ds, info, keepGuests, prevGuests) => {
    if (info?.status === 'fully_booked' || info?.status === 'closed') {
      // No bookable combination — surface a friendly message + next open day.
      setGuestCount(null);
      api
        .nextAvailability(id, ds, keepGuests ? prevGuests || undefined : undefined)
        .then(setNextAvail)
        .catch(() => setNextAvail(null));
      setActiveStep('guests');
      return;
    }
    api
      .getAvailability(id, ds)
      .then(setAvailability)
      .catch(() => setAvailability({ reservations: [], blockedPeriods: [] }));
    if (keepGuests && prevGuests) {
      setGuestCount(prevGuests);
      setActiveStep(allowTableSelection ? 'table' : 'time');
    } else {
      setGuestCount(null);
      setActiveStep('guests');
    }
  };

  const handleDateChangeInline = (date, keepGuests = false) => {
    const ds = formatDateString(date);
    const prevGuests = guestCount;
    setSelectedDate(date);
    setSelectedTable(null);
    setSelectedTime(null);
    setAvailability(null);
    setNextAvail(null);
    updateReservation('restaurant', restaurant);
    // Carry the reservation config forward so the details form can honour
    // required-fields + reservation notice settings.
    updateReservation('config', config);
    updateReservation('date', ds);
    const info = calendarStatus[ds];
    if (info) {
      routeForDay(ds, info, keepGuests, prevGuests);
    } else {
      // Status not prefetched (date beyond the ~45-day calendar window). Fetch
      // just this day so the closed/fully-booked guard has data, then route.
      setActiveStep('guests');
      api
        .availabilityCalendar(id, ds, ds)
        .then((m) => {
          setCalendarStatus((p) => ({ ...p, ...m }));
          routeForDay(ds, m[ds], keepGuests, prevGuests);
        })
        .catch(() => routeForDay(ds, undefined, keepGuests, prevGuests));
    }
  };

  const selectDateString = (ds) => handleDateChangeInline(new Date(ds + 'T00:00:00'));
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  // "Today" / "Tomorrow" / "Day after tomorrow" for the nearest days, else null.
  const relativeDayLabel = (date) => {
    if (!date) return null;
    const b = new Date(date);
    b.setHours(0, 0, 0, 0);
    const diff = Math.round((b.getTime() - startOfToday().getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === 2) return 'Day after tomorrow';
    return null;
  };
  const goPrevDay = () => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    if (d < startOfToday()) return;
    handleDateChangeInline(d);
  };

  // ---- Inline date navigator (used on the Table & Time steps) ----
  const navToDate = (date) => {
    if (date < startOfToday()) return;
    if (maxBookingDate && date > maxBookingDate) return;
    handleDateChangeInline(date, true); // keep the chosen party size
  };
  const navPrevDay = () => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    navToDate(d);
  };
  const navNextDay = () => {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    navToDate(d);
  };
  const canGoPrevDay =
    !!selectedDate && formatDateString(selectedDate) > formatDateString(startOfToday());
  const canGoNextDay =
    !!selectedDate &&
    (!maxBookingDate || formatDateString(selectedDate) < formatDateString(maxBookingDate));
  const findNextAvailableDay = () => {
    if (!selectedDate) return;
    api
      .nextAvailability(id, formatDateString(selectedDate), guestCount || undefined)
      .then((r) => {
        if (r?.date) handleDateChangeInline(new Date(r.date + 'T00:00:00'), true);
        else setActiveStep('date'); // nothing in the horizon — fall back to the calendar
      })
      .catch(() => setActiveStep('date'));
  };
  const selectedDayBlocked =
    !!selectedDate &&
    ['fully_booked', 'closed'].includes(calendarStatus[formatDateString(selectedDate)]?.status);
  const selectedDayDesc =
    selectedDate && selectedDayBlocked
      ? describeUnavailableDay(
          formatDateString(selectedDate),
          calendarStatus[formatDateString(selectedDate)],
          holidayClosures,
        )
      : null;

  const handleGuestSelect = (count) => {
    setGuestCount(count);
    setSelectedTable(null);
    setSelectedTime(null);
    updateReservation('guests', count);
    setActiveStep(allowTableSelection ? 'table' : 'time');
  };

  const handleTableSelect = (table) => {
    const status = getTableStatus(table);
    if (status === 'disabled' || status === 'occupied') return;
    setSelectedTable(table);
    setSelectedTime(null);
    updateReservation('table', table);
    setActiveStep('time');
  };

  const handleTimeSelect = (startMinutes) => {
    if (startMinutes < earliestStart) return; // lead-time / same-day cutoff
    const endMinutes = startMinutes + suggestedDuration;
    if (startMinutes >= kitchenClosingMinutes) return;
    if (endMinutes > closingMinutes) return;
    for (const iv of tableReservations) {
      let s = parseTime(iv.start);
      let e = parseTime(iv.end);
      if (e <= openingMinutes) e += 24 * 60;
      if (s < openingMinutes) s = openingMinutes;
      if (startMinutes < e && endMinutes > s) return;
    }
    if (closingMinutes - startMinutes <= 60) {
      setPendingTime(startMinutes);
      setShowWarningModal(true);
      return;
    }
    confirmTimeSelection(startMinutes);
  };

  const confirmTimeSelection = (startMinutes) => {
    const timeSlot = {
      start: formatTime(startMinutes),
      end: formatTime(startMinutes + suggestedDuration),
    };
    setSelectedTime(timeSlot);
    updateReservation('timeSlot', timeSlot);
    setShowWarningModal(false);
    setPendingTime(null);
    setTimeout(() => navigate('/reservation/form'), 400);
  };

  const getSlotStatus = (slotStart) => {
    const slotEnd = slotStart + suggestedDuration;
    if (slotStart < earliestStart) return 'past'; // before lead time / after cutoff
    if (slotStart >= kitchenClosingMinutes) return 'kitchen-closed';
    if (slotStart >= closingMinutes) return 'closed';
    if (slotEnd > closingMinutes) return 'closed';
    for (const iv of tableReservations) {
      let s = parseTime(iv.start);
      let e = parseTime(iv.end);
      if (e <= openingMinutes) e += 24 * 60;
      if (s < openingMinutes) s = openingMinutes;
      if (slotStart < e && slotEnd > s) return 'reserved';
    }
    return 'available';
  };

  const timeSlots = [];
  for (let m = openingMinutes; m < closingMinutes; m += slotStep) {
    timeSlots.push(m);
  }
  const hasAvailableSlot = timeSlots.some((s) => getSlotStatus(s) === 'available');
  // For the table step: is there any table the chosen party can actually take?
  const selectableTableExists =
    !!guestCount && tables.some((t) => ['available', 'selected'].includes(getTableStatus(t)));
  const largestTableCap = tables.length ? Math.max(...tables.map((t) => t.capacity || 0)) : 0;
  const partyTooLarge = !!guestCount && largestTableCap > 0 && largestTableCap < guestCount;
  // Smallest minimum across all tables — if the party is below it, no table will
  // take such a small group on any day.
  const smallestTableMin = tables.length
    ? Math.min(...tables.map((t) => t.minCapacity || 1))
    : 1;
  const partyTooSmall = !!guestCount && guestCount < smallestTableMin;

  const tileDisabled = ({ date, view }) => {
    if (view !== 'month') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Only the past (and, via maxDate, beyond the booking window) is truly
    // unselectable. Closed AND fully-booked days stay clickable on purpose, so
    // tapping one reveals the exact reason ("Closed on Sundays", "Fully booked")
    // plus the next available day — never a silent dead tile.
    return date < today;
  };

  // Small colour-coded dot + hover tooltip per day so customers see
  // limited / fully-booked / closed days at a glance.
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const ds = formatDateString(date);
    const info = calendarStatus[ds];
    const st = info?.status;
    if (!st || st === 'available') return null;
    const color = st === 'fully_booked' ? '#ef4444' : st === 'limited' ? '#f59e0b' : '#9ca3af';
    const title =
      st === 'limited'
        ? 'Limited availability — book soon'
        : describeUnavailableDay(ds, info, holidayClosures).title;
    return (
      <span
        title={title}
        aria-label={title}
        role="img"
        style={{
          display: 'block',
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: color,
          margin: '2px auto 0',
        }}
      />
    );
  };

  const tooltipFor = (table) => {
    const status = getTableStatus(table);
    const minCap = table.minCapacity || 1;
    if (status === 'occupied') return 'Fully booked';
    if (status === 'disabled' && guestCount) {
      if (guestCount > table.capacity) return `Seats up to ${table.capacity} — too small for ${guestCount}`;
      if (guestCount < minCap) return `For groups of ${minCap}+ only`;
    }
    const tagLabels = (table.tags || []).map((t) => t.replace(/_/g, ' ')).join(', ');
    const seats = minCap > 1 ? `${minCap}–${table.capacity}` : `${table.capacity}`;
    return `Table ${table.number} · ${seats} seats${tagLabels ? ' · ' + tagLabels : ''}`;
  };

  const goBack = () => {
    switch (activeStep) {
      case 'guests': setActiveStep('date'); break;
      case 'table': setActiveStep('guests'); break;
      case 'time': setActiveStep(allowTableSelection ? 'table' : 'guests'); break;
      default: break;
    }
  };

  // Compact date switcher for the Table & Time steps so the diner can change
  // the day in one tap (Prev / Today / Next / open calendar) without backing
  // all the way out to the calendar.
  const navBtn =
    'flex items-center gap-1 px-3 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed';
  const renderDateNav = () => (
    <div className="flex items-center justify-between gap-2 bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-4">
      <button onClick={navPrevDay} disabled={!canGoPrevDay} className={navBtn} aria-label="Previous day">
        <FiChevronLeft size={18} />
        <span className="hidden sm:inline">Prev</span>
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => setActiveStep('date')}
          aria-label="Change date — open calendar"
          className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-w-0"
        >
          <FiCalendar size={15} className="shrink-0 text-gray-400" />
          <span className="flex flex-col items-start leading-tight min-w-0">
            <span className="truncate">
              {relativeDayLabel(selectedDate) || (selectedDate ? formatDateMedium(selectedDate) : 'Pick a date')}
            </span>
            {relativeDayLabel(selectedDate) && selectedDate && (
              <span className="text-[11px] font-normal text-gray-400 truncate">{formatDateMedium(selectedDate)}</span>
            )}
          </span>
          <FiChevronDown size={14} className="shrink-0 text-gray-400" />
        </button>
        {!isToday && (
          <button
            onClick={() => navToDate(startOfToday())}
            aria-label="Go back to today"
            className="shrink-0 min-h-[44px] px-3 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-full hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Back to today
          </button>
        )}
      </div>
      <button onClick={navNextDay} disabled={!canGoNextDay} className={navBtn} aria-label="Next day">
        <span className="hidden sm:inline">Next</span>
        <FiChevronRight size={18} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero with image gallery */}
      <motion.section
        className="relative h-56 md:h-72 lg:h-80 overflow-hidden"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      >
        <img src={images[activeImage]?.url} alt={restaurant.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {(restaurant.cuisines?.length ? restaurant.cuisines : restaurant.cuisine ? [restaurant.cuisine] : []).map((c) => (
                <span key={c} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500 text-white capitalize">
                  {c}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-400 text-gray-900">
                <FiStar className="fill-current" size={14} />
                {restaurant.rating}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">{restaurant.name}</h1>
            <p className="flex items-center gap-2 text-gray-200 text-sm md:text-base">
              <FiMapPin size={16} />
              {restaurant.address}
            </p>
          </div>
        </div>
      </motion.section>

      {images.length > 1 && (
        <div className="max-w-6xl mx-auto px-4 mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={img.id || idx}
              onClick={() => setActiveImage(idx)}
              className={`relative h-16 w-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                activeImage === idx ? 'border-emerald-500' : 'border-transparent opacity-80 hover:opacity-100'
              }`}
              aria-label={`View ${img.type?.toLowerCase() || 'photo'}`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Info Panel */}
      <motion.section
        className="max-w-6xl mx-auto px-4 mt-6 relative z-10"
        variants={fadeIn} initial="hidden" animate="visible"
      >
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href={`https://${restaurant.website}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer group">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FiGlobe className="text-blue-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Website</p>
                <p className="text-sm font-medium text-blue-600 group-hover:underline truncate">{restaurant.website}</p>
              </div>
            </a>

            <a href={`tel:${restaurant.phone}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <FiPhone className="text-green-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.phone}</p>
              </div>
            </a>

            <button onClick={() => setShowMenuModal(true)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors text-left cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <FiBookOpen className="text-purple-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Menu</p>
                <p className="text-sm font-medium text-purple-600">View Menu</p>
              </div>
            </button>

            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <FiNavigation className="text-orange-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Directions</p>
                <p className="text-sm font-medium text-orange-600">Get Directions</p>
              </div>
            </a>

            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <FiClock className="text-emerald-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Open</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.openingTime}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <FiClock className="text-yellow-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Kitchen Closes</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.kitchenClosing}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <FiClock className="text-red-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Restaurant Closes</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.closingTime}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-indigo-600 font-bold text-sm">₾</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg. Meal Price</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.priceRange}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {onlineEnabled && (
        <div ref={stepContainerRef} className="max-w-6xl mx-auto px-4 mt-8">
          <StepIndicator currentStep={currentStep} />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {!onlineEnabled && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center max-w-xl mx-auto">
            <div className="text-5xl mb-3">📞</div>
            <h3 className="text-lg font-semibold text-gray-800">Online booking unavailable</h3>
            <p className="text-gray-500 mt-2">
              This restaurant isn't accepting online reservations right now. Please call to book your table.
            </p>
            <a
              href={`tel:${restaurant.phone}`}
              className="mt-4 inline-block px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
            >
              Call {restaurant.phone}
            </a>
          </div>
        )}
        {onlineEnabled && (
        <AnimatePresence mode="wait">
          {(activeStep === 'date' || activeStep === 'guests') && (
            <motion.div key="date-guests-step" variants={fadeIn} initial="hidden" animate="visible" exit="exit">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">1</span>
                    Select a Date
                  </h2>
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <Calendar
                      onChange={(value) => handleDateChangeInline(value)}
                      value={selectedDate}
                      tileDisabled={tileDisabled}
                      tileContent={tileContent}
                      onActiveStartDateChange={({ activeStartDate }) =>
                        activeStartDate && loadCalendar(activeStartDate)
                      }
                      minDate={new Date()}
                      maxDate={maxBookingDate || undefined}
                      className="w-full border-none"
                    />
                    {/* Calendar legend */}
                    <div className="flex flex-wrap gap-3 mt-3 px-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} /> Limited</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} /> Fully booked</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#9ca3af' }} /> Closed</span>
                    </div>
                    {(maxWindowDays > 0 || leadMinutes > 0) && (
                      <p className="text-xs text-gray-400 mt-2 px-1">
                        {maxWindowDays > 0 && `You can book up to ${maxWindowDays} days in advance. `}
                        {leadMinutes > 0 &&
                          `Same-day bookings need ${
                            leadMinutes % 60 === 0 ? `${leadMinutes / 60}h` : `${leadMinutes} min`
                          } notice.`}
                      </p>
                    )}
                  </div>
                </div>

                {selectedDate && selectedDayBlocked && (
                  <motion.div variants={fadeIn} initial="hidden" animate="visible">
                    <div className="bg-white rounded-xl shadow-md p-8 text-center">
                      <div className="text-5xl mb-3">{selectedDayDesc?.emoji || '📅'}</div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {selectedDayDesc?.title || 'Unavailable'}
                      </h3>
                      <p className="text-gray-500 mt-1 text-sm">{formatDateDisplay(selectedDate)}</p>
                      <p className="text-gray-500 mt-2">{selectedDayDesc?.message}</p>
                      <p className="text-gray-400 text-sm mt-1">Try another date or check nearby days.</p>
                      {nextAvail?.date && (
                        <div className="mt-4 inline-block px-4 py-2 bg-emerald-50 text-emerald-800 rounded-lg text-sm">
                          Next availability:{' '}
                          <strong>
                            {formatDateDisplay(new Date(nextAvail.date + 'T00:00:00'))} at {nextAvail.time}
                          </strong>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 justify-center mt-5">
                        <button
                          onClick={goPrevDay}
                          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 min-h-[44px]"
                        >
                          ← Previous Day
                        </button>
                        {nextAvail?.date && (
                          <button
                            onClick={() => selectDateString(nextAvail.date)}
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 min-h-[44px]"
                          >
                            Next Available Day →
                          </button>
                        )}
                      </div>
                      {/* Always offer a way to reach the restaurant directly. */}
                      {restaurant.phone && (
                        <a
                          href={`tel:${restaurant.phone}`}
                          className="inline-flex items-center gap-1.5 mt-4 text-sm text-emerald-700 hover:underline"
                        >
                          <FiPhone size={14} /> Call the restaurant
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
                {selectedDate && !selectedDayBlocked && (
                  <motion.div variants={fadeIn} initial="hidden" animate="visible">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">2</span>
                      How many guests?
                    </h2>
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <p className="text-sm text-gray-500 mb-4">
                        Date: <span className="font-medium text-gray-700">{formatDateDisplay(selectedDate)}</span>
                      </p>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {(() => {
                          const min = config?.minGroupSize || 1;
                          // Cap at the SMALLEST configured upper bound so every
                          // limit (group size, per-reservation max) is honoured.
                          const caps = [
                            config?.maxGroupSize,
                            config?.maxGuestsPerReservation,
                            config?.capacityRules?.maxGuestsPerReservation,
                            config?.maxGuests,
                          ].filter((n) => typeof n === 'number' && n > 0);
                          const max = Math.max(min, caps.length ? Math.min(...caps) : 20);
                          return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
                        })().map((num) => (
                          <motion.button
                            key={num}
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                            onClick={() => handleGuestSelect(num)}
                            className={`w-full aspect-square rounded-lg text-lg font-semibold transition-colors flex items-center justify-center min-h-[44px] ${
                              guestCount === num ? 'bg-emerald-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {num}
                          </motion.button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">
                        Reservations are held for {Math.round((suggestedDuration / 60) * 10) / 10} hours.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeStep === 'table' && (
            <motion.div key="table-step" variants={fadeIn} initial="hidden" animate="visible" exit="exit">
              <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 mb-4 min-h-[44px] px-2 rounded-lg transition-colors">
                <FiArrowLeft size={18} />
                <span className="text-sm font-medium">Back to date & guests</span>
              </button>

              {renderDateNav()}

              <p className="text-sm text-gray-500 mb-4">
                <span className="font-medium">{guestCount} {guestCount === 1 ? 'guest' : 'guests'}</span>
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">3</span>
                Choose Your Table
              </h2>

              {guestCount && !selectableTableExists && (
                <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm flex items-start gap-2">
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  <div>
                    {partyTooLarge
                      ? `No table can seat ${guestCount} guests on this day${
                          largestTableCap ? ` — the largest seats ${largestTableCap}` : ''
                        }. Try a smaller party, another day, or contact the restaurant.`
                      : partyTooSmall
                        ? `These tables take groups of ${smallestTableMin} or more. Try a larger party or contact the restaurant.`
                        : 'All suitable tables are already booked for this day. Try another day or time.'}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveStep('guests')}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 text-xs font-medium hover:bg-amber-100 min-h-[40px]"
                      >
                        Change guests
                      </button>
                      <button
                        onClick={() => setActiveStep('date')}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 text-xs font-medium hover:bg-amber-100 min-h-[40px]"
                      >
                        Choose another day
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{ background: '#3B82F6' }} /><span className="text-sm text-gray-600">Available</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{ background: '#10B981' }} /><span className="text-sm text-gray-600">Selected</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{ background: '#EF4444' }} /><span className="text-sm text-gray-600">Occupied</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{ background: '#D1D5DB' }} /><span className="text-sm text-gray-600">Unavailable</span></div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 md:p-6 overflow-hidden">
                <div className="relative w-full" style={{ paddingBottom: '60%' }}>
                  <div className="absolute inset-0">
                    <FloorPlanCanvas
                      elements={restaurant.floorPlan?.elements || []}
                      tables={tables}
                      background={restaurant.floorPlan?.background || null}
                      getTableStatus={getTableStatus}
                      onTableClick={handleTableSelect}
                      onTableHover={(t) => setHoveredTable(t ? t.id : null)}
                      hoveredTableId={hoveredTable}
                      selectedTableId={selectedTable?.id || null}
                      tooltipFor={tooltipFor}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeStep === 'time' && (
            <motion.div key="time-step" variants={fadeIn} initial="hidden" animate="visible" exit="exit">
              <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 mb-4 min-h-[44px] px-2 rounded-lg transition-colors">
                <FiArrowLeft size={18} />
                <span className="text-sm font-medium">{allowTableSelection ? 'Back to table selection' : 'Back to guests'}</span>
              </button>

              {renderDateNav()}

              <p className="text-sm text-gray-500 mb-4">
                {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
                {selectedTable && <> &middot; Table {selectedTable.number} ({selectedTable.capacity} seats)</>}
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">4</span>
                Select a Time Slot
              </h2>

              <p className="text-sm text-gray-500 mb-4">Reservation duration: {Math.round((suggestedDuration / 60) * 10) / 10} hours</p>

              {/* Same-day timing hints (lead time / cutoff), reflected from settings */}
              {isToday && earliestStart === Infinity && (
                <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <FiClock className="mt-0.5 shrink-0" />
                    <span>Same-day online bookings are closed for today. Pick another day to book.</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={findNextAvailableDay}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 min-h-[40px]"
                    >
                      Find next available day →
                    </button>
                    <button
                      onClick={() => setActiveStep('date')}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 text-xs font-medium hover:bg-amber-100 min-h-[40px]"
                    >
                      Open calendar
                    </button>
                  </div>
                </div>
              )}
              {isToday && hasAvailableSlot && Number.isFinite(earliestStart) && earliestStart > openingMinutes && (
                <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-sm">
                  <FiClock className="mt-0.5 shrink-0" />
                  <span>The earliest time you can book today is {formatTime(earliestStart)}.</span>
                </div>
              )}

              {!hasAvailableSlot && earliestStart !== Infinity && (
                <div className="mb-4 bg-white rounded-xl shadow-md p-6 text-center">
                  <div className="text-4xl mb-2">⏳</div>
                  <h3 className="text-base font-semibold text-gray-800">No times available</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {isToday
                      ? 'There are no more bookable times today. Please try another day.'
                      : 'Every time for this selection is taken. Try another day or table.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={findNextAvailableDay}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 min-h-[44px]"
                    >
                      Find next available day →
                    </button>
                    <button
                      onClick={() => setActiveStep('date')}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 min-h-[44px]"
                    >
                      Open calendar
                    </button>
                  </div>
                </div>
              )}

              {hasAvailableSlot && (
                <>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-500" /><span className="text-sm text-gray-600">Available</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-400" /><span className="text-sm text-gray-600">Reserved</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-orange-400" /><span className="text-sm text-gray-600">Kitchen Closed</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-700" /><span className="text-sm text-gray-600">Closed</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-300" /><span className="text-sm text-gray-600">Too soon / Past</span></div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 md:p-6 space-y-5">
                {(() => {
                  // Group slots by daypart so the times are scannable instead of
                  // a cramped strip of overlapping labels.
                  const sections = [];
                  let cur = null;
                  for (const s of timeSlots) {
                    const h = Math.floor((((s % 1440) + 1440) % 1440) / 60);
                    const label = h < 12 ? 'Morning' : h < 17 ? 'Midday' : h < 22 ? 'Evening' : 'Late night';
                    if (!cur || cur.label !== label) {
                      cur = { label, slots: [] };
                      sections.push(cur);
                    }
                    cur.slots.push(s);
                  }
                  return sections.map((sec) => (
                    <div key={`${sec.label}-${sec.slots[0]}`}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{sec.label}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {sec.slots.map((slotStart) => {
                          const status = getSlotStatus(slotStart);
                          const clickable = status === 'available';
                          const cls =
                            status === 'available'
                              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                              : status === 'reserved'
                                ? 'border-rose-100 bg-rose-50 text-rose-300 line-through cursor-not-allowed'
                                : status === 'kitchen-closed'
                                  ? 'border-orange-100 bg-orange-50 text-orange-400 cursor-not-allowed'
                                  : status === 'closed'
                                    ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed';
                          return (
                            <button
                              key={slotStart}
                              disabled={!clickable}
                              onClick={() => clickable && handleTimeSelect(slotStart)}
                              title={`${formatTime(slotStart)} – ${formatTime(slotStart + suggestedDuration)}`}
                              className={`min-h-[44px] rounded-lg border text-sm font-semibold transition-colors ${cls}`}
                            >
                              {formatTime(slotStart)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </div>

      {/* Menu Modal */}
      <AnimatePresence>
        {showMenuModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setShowMenuModal(false); }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">{restaurant.name} - Menu</h3>
                <button onClick={() => setShowMenuModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Close menu">
                  <FiX size={20} />
                </button>
              </div>
              {groupMenu(restaurant.menu).map((section) => (
                <div key={section.category} className="mb-6 last:mb-0">
                  <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wide mb-3 border-b border-gray-100 pb-2">{section.category}</h4>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <div key={item.id || item.name} className="flex items-center justify-between py-1">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-gray-900 font-medium">{item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Closing Time Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <FiAlertTriangle className="text-yellow-600" size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">The restaurant closes soon</h3>
                <button onClick={() => { setShowWarningModal(false); setPendingTime(null); }} className="ml-auto text-gray-400 hover:text-gray-600">
                  <FiX size={20} />
                </button>
              </div>
              <p className="text-gray-600 mb-6">
                This reservation begins within an hour of closing. The restaurant closes at{' '}
                <span className="font-semibold">{restaurant.closingTime}</span>. Are you sure you want to continue?
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setShowWarningModal(false); setPendingTime(null); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors min-h-[44px]">
                  Choose Another Time
                </button>
                <button onClick={() => confirmTimeSelection(pendingTime)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors min-h-[44px]">
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
