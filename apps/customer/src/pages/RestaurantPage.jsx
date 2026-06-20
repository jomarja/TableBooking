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
  const defaultDuration = config?.defaultDuration || 90;
  const suggestedDuration = computeDuration(guestCount, durationByGuests, defaultDuration);

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
    if (table.capacity < guestCount) return 'disabled';
    if (table.capacity > guestCount * 3) return 'disabled';

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

  const handleDateChangeInline = (date) => {
    setSelectedDate(date);
    setGuestCount(null);
    setSelectedTable(null);
    setSelectedTime(null);
    setAvailability(null);
    updateReservation('restaurant', restaurant);
    updateReservation('date', formatDateString(date));
    api
      .getAvailability(id, formatDateString(date))
      .then(setAvailability)
      .catch(() => setAvailability({ reservations: [], blockedPeriods: [] }));
    setActiveStep('guests');
  };

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
  for (let m = openingMinutes; m < closingMinutes; m += 30) {
    timeSlots.push(m);
  }

  const tileDisabled = ({ date }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    const ds = formatDateString(date);
    return holidayClosures.some((h) => h.date === ds);
  };

  const tooltipFor = (table) => {
    const status = getTableStatus(table);
    if (status === 'occupied') return 'Fully booked';
    if (status === 'disabled' && guestCount) {
      if (table.capacity < guestCount) return `Too small for ${guestCount} guests`;
      if (table.capacity > guestCount * 3) return `Too large for ${guestCount} guests`;
    }
    const tagLabels = (table.tags || []).map((t) => t.replace(/_/g, ' ')).join(', ');
    return `Table ${table.number} · ${table.capacity} seats${tagLabels ? ' · ' + tagLabels : ''}`;
  };

  const goBack = () => {
    switch (activeStep) {
      case 'guests': setActiveStep('date'); break;
      case 'table': setActiveStep('guests'); break;
      case 'time': setActiveStep(allowTableSelection ? 'table' : 'guests'); break;
      default: break;
    }
  };

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
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500 text-white">
                {restaurant.cuisine.charAt(0).toUpperCase() + restaurant.cuisine.slice(1)}
              </span>
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
                <span className="text-indigo-600 font-bold text-sm">$</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg. Meal Price</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.priceRange}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <div ref={stepContainerRef} className="max-w-6xl mx-auto px-4 mt-8">
        <StepIndicator currentStep={currentStep} />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
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
                    <Calendar onChange={handleDateChangeInline} value={selectedDate} tileDisabled={tileDisabled} minDate={new Date()} className="w-full border-none" />
                  </div>
                </div>

                {selectedDate && (
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
                        {Array.from({ length: Math.min(config?.maxGuests || 20, 20) }, (_, i) => i + 1).map((num) => (
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

              <p className="text-sm text-gray-500 mb-4">
                {formatDateDisplay(selectedDate)} &middot; <span className="font-medium">{guestCount} {guestCount === 1 ? 'guest' : 'guests'}</span>
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">3</span>
                Choose Your Table
              </h2>

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

              <p className="text-sm text-gray-500 mb-4">
                {formatDateDisplay(selectedDate)} &middot; {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
                {selectedTable && <> &middot; Table {selectedTable.number} ({selectedTable.capacity} seats)</>}
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">4</span>
                Select a Time Slot
              </h2>

              <p className="text-sm text-gray-500 mb-4">Reservation duration: {Math.round((suggestedDuration / 60) * 10) / 10} hours</p>

              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-400" /><span className="text-sm text-gray-600">Available</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-400" /><span className="text-sm text-gray-600">Reserved</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-orange-400" /><span className="text-sm text-gray-600">Kitchen Closed</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-700" /><span className="text-sm text-gray-600">Closed</span></div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 md:p-6 overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="relative h-16 bg-gray-100 rounded-lg overflow-hidden flex">
                    {timeSlots.map((slotStart, idx) => {
                      const status = getSlotStatus(slotStart);
                      const slotWidth = 100 / timeSlots.length;
                      let bgColor;
                      let isClickable = false;
                      switch (status) {
                        case 'available': bgColor = 'bg-emerald-400 hover:bg-emerald-500'; isClickable = true; break;
                        case 'reserved': bgColor = 'bg-red-400'; break;
                        case 'kitchen-closed': bgColor = 'bg-orange-400'; break;
                        case 'closed': bgColor = 'bg-gray-700'; break;
                        default: bgColor = 'bg-gray-300';
                      }
                      return (
                        <button
                          key={idx}
                          onClick={() => isClickable && handleTimeSelect(slotStart)}
                          disabled={!isClickable}
                          className={`h-full border-r border-white/20 flex items-center justify-center text-xs font-medium transition-colors ${bgColor} ${
                            isClickable ? 'cursor-pointer text-white' : 'cursor-not-allowed text-white/70'
                          }`}
                          style={{ width: `${slotWidth}%` }}
                          title={`${formatTime(slotStart)} - ${formatTime(slotStart + 30)}`}
                        >
                          <span className="hidden sm:inline">{formatTime(slotStart)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex mt-2">
                    {timeSlots.filter((_, idx) => idx % 2 === 0).map((slotStart, idx) => (
                      <div key={idx} className="text-xs text-gray-500" style={{ width: `${(100 / timeSlots.length) * 2}%` }}>
                        {formatTime(slotStart)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Menu Modal */}
      <AnimatePresence>
        {showMenuModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMenuModal(false)}>
            <motion.div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
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
