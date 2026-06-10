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
  FiUsers,
  FiAlertTriangle,
  FiX,
  FiNavigation,
  FiBookOpen,
  FiArrowLeft,
} from 'react-icons/fi';
import { restaurants } from '../data/restaurants';
import StepIndicator from '../components/StepIndicator';
import { useReservation } from '../context/ReservationContext';

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

const menuItems = [
  { category: 'Starters', items: [{ name: 'Bruschetta', price: '$8' }, { name: 'Caesar Salad', price: '$12' }, { name: 'Soup of the Day', price: '$9' }] },
  { category: 'Main Course', items: [{ name: 'Grilled Salmon', price: '$24' }, { name: 'Beef Steak', price: '$32' }, { name: 'Pasta Carbonara', price: '$18' }, { name: 'Chicken Marsala', price: '$22' }] },
  { category: 'Desserts', items: [{ name: 'Tiramisu', price: '$10' }, { name: 'Cheesecake', price: '$9' }, { name: 'Ice Cream', price: '$7' }] },
  { category: 'Drinks', items: [{ name: 'Wine (glass)', price: '$8' }, { name: 'Beer', price: '$6' }, { name: 'Fresh Juice', price: '$5' }, { name: 'Coffee', price: '$4' }] },
];

export default function RestaurantPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateReservation } = useReservation();
  const stepContainerRef = useRef(null);

  const restaurant = restaurants.find((r) => r.id === Number(id));

  const [activeStep, setActiveStep] = useState('date');
  const [selectedDate, setSelectedDate] = useState(null);
  const [guestCount, setGuestCount] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [pendingTime, setPendingTime] = useState(null);
  const [hoveredTable, setHoveredTable] = useState(null);

  const scrollToStep = () => {
    if (stepContainerRef.current) {
      stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    scrollToStep();
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

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Restaurant not found.</p>
      </div>
    );
  }

  const openingMinutes = parseTime(restaurant.openingTime);
  const kitchenClosingMinutes = parseTime(restaurant.kitchenClosing);
  let closingMinutes = parseTime(restaurant.closingTime);
  if (closingMinutes <= openingMinutes) closingMinutes += 24 * 60;

  const dateString = selectedDate ? formatDateString(selectedDate) : '';

  const tableReservations = selectedTable && dateString
    ? restaurant.reservations.filter(
        (r) => r.tableId === selectedTable.id && r.date === dateString
      )
    : [];

  const getTableStatus = (table) => {
    if (!guestCount) return 'disabled';
    if (table.capacity < guestCount) return 'disabled';
    if (table.capacity > guestCount * 3) return 'disabled';

    const tableRes = restaurant.reservations.filter(
      (r) => r.tableId === table.id && r.date === dateString
    );

    if (tableRes.length > 0) {
      const sortedRes = [...tableRes].sort(
        (a, b) => parseTime(a.startTime) - parseTime(b.startTime)
      );
      let coveredFrom = openingMinutes;
      for (const res of sortedRes) {
        let resStart = parseTime(res.startTime);
        let resEnd = parseTime(res.endTime);
        if (resEnd <= openingMinutes) resEnd += 24 * 60;
        if (resStart <= openingMinutes) resStart = openingMinutes;
        if (resStart <= coveredFrom) {
          coveredFrom = Math.max(coveredFrom, resEnd);
        }
      }
      if (coveredFrom >= closingMinutes) return 'occupied';
    }

    if (selectedTable && selectedTable.id === table.id) return 'selected';
    return 'available';
  };

  const getTableColor = (status) => {
    switch (status) {
      case 'available': return '#3B82F6';
      case 'selected': return '#10B981';
      case 'occupied': return '#EF4444';
      case 'disabled':
      default: return '#D1D5DB';
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setGuestCount(null);
    setSelectedTable(null);
    setSelectedTime(null);
    updateReservation('restaurant', restaurant);
    updateReservation('date', formatDateString(date));
    setActiveStep('guests');
  };

  const handleDateChangeInline = (date) => {
    setSelectedDate(date);
    setGuestCount(null);
    setSelectedTable(null);
    setSelectedTime(null);
    updateReservation('restaurant', restaurant);
    updateReservation('date', formatDateString(date));
  };

  const handleGuestSelect = (count) => {
    setGuestCount(count);
    setSelectedTable(null);
    setSelectedTime(null);
    updateReservation('guests', count);
    setActiveStep('table');
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
    const duration = 90;
    const endMinutes = startMinutes + duration;

    if (startMinutes >= kitchenClosingMinutes) return;
    if (endMinutes > closingMinutes) return;
    for (const res of tableReservations) {
      let resStart = parseTime(res.startTime);
      let resEnd = parseTime(res.endTime);
      if (resEnd <= openingMinutes) resEnd += 24 * 60;
      if (resStart < openingMinutes) resStart = openingMinutes;
      if (startMinutes < resEnd && endMinutes > resStart) return;
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
      end: formatTime(startMinutes + 90),
    };
    setSelectedTime(timeSlot);
    updateReservation('timeSlot', timeSlot);
    setShowWarningModal(false);
    setPendingTime(null);

    setTimeout(() => {
      navigate('/reservation/form');
    }, 400);
  };

  const getSlotStatus = (slotStart) => {
    const slotEnd = slotStart + 90;

    if (slotStart >= kitchenClosingMinutes) return 'kitchen-closed';
    if (slotStart >= closingMinutes) return 'closed';
    if (slotEnd > closingMinutes) return 'closed';

    for (const res of tableReservations) {
      let resStart = parseTime(res.startTime);
      let resEnd = parseTime(res.endTime);
      if (resEnd <= openingMinutes) resEnd += 24 * 60;
      if (resStart < openingMinutes) resStart = openingMinutes;
      if (slotStart < resEnd && slotEnd > resStart) return 'reserved';
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
    return date < today;
  };

  const goBack = () => {
    switch (activeStep) {
      case 'guests':
        setActiveStep('date');
        break;
      case 'table':
        setActiveStep('guests');
        break;
      case 'time':
        setActiveStep('table');
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <motion.section
        className="relative h-56 md:h-72 lg:h-80 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
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
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
              {restaurant.name}
            </h1>
            <p className="flex items-center gap-2 text-gray-200 text-sm md:text-base">
              <FiMapPin size={16} />
              {restaurant.address}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Info Panel */}
      <motion.section
        className="max-w-6xl mx-auto px-4 -mt-6 relative z-10"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
      >
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href={`https://${restaurant.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FiGlobe className="text-blue-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Website</p>
                <p className="text-sm font-medium text-blue-600 group-hover:underline truncate">
                  {restaurant.website}
                </p>
              </div>
            </a>

            <a
              href={`tel:${restaurant.phone}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <FiPhone className="text-green-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.phone}</p>
              </div>
            </a>

            <button
              onClick={() => setShowMenuModal(true)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <FiBookOpen className="text-purple-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Menu</p>
                <p className="text-sm font-medium text-purple-600">View Menu</p>
              </div>
            </button>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer"
            >
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
                <p className="text-xs text-gray-500">Opening Time</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.openingTime}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <FiClock className="text-yellow-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Kitchen Closing</p>
                <p className="text-sm font-medium text-gray-800">{restaurant.kitchenClosing}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <FiClock className="text-red-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Restaurant Closing</p>
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

      {/* Step Indicator */}
      <div ref={stepContainerRef} className="max-w-6xl mx-auto px-4 mt-8">
        <StepIndicator currentStep={currentStep} />
      </div>

      {/* Reservation Flow - One step at a time */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Step 1 & 2: Date + Guest Selection (side by side) */}
          {(activeStep === 'date' || activeStep === 'guests') && (
            <motion.div
              key="date-guests-step"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calendar */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">1</span>
                    Select a Date
                  </h2>
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <Calendar
                      onChange={handleDateChangeInline}
                      value={selectedDate}
                      tileDisabled={tileDisabled}
                      minDate={new Date()}
                      className="w-full border-none"
                    />
                  </div>
                </div>

                {/* Guest Selection - appears after date is picked */}
                {selectedDate && (
                  <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="visible"
                  >
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">2</span>
                      How many guests?
                    </h2>
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <p className="text-sm text-gray-500 mb-4">
                        Date: <span className="font-medium text-gray-700">{formatDateDisplay(selectedDate)}</span>
                      </p>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                          <motion.button
                            key={num}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleGuestSelect(num)}
                            className={`w-full aspect-square rounded-lg text-lg font-semibold transition-colors flex items-center justify-center min-h-[44px] ${
                              guestCount === num
                                ? 'bg-emerald-500 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {num}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Floor Plan / Table Selection */}
          {activeStep === 'table' && (
            <motion.div
              key="table-step"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <button
                onClick={goBack}
                className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 mb-4 min-h-[44px] px-2 rounded-lg transition-colors"
              >
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

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: '#3B82F6' }} />
                  <span className="text-sm text-gray-600">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: '#10B981' }} />
                  <span className="text-sm text-gray-600">Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: '#EF4444' }} />
                  <span className="text-sm text-gray-600">Occupied</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: '#D1D5DB' }} />
                  <span className="text-sm text-gray-600">Unavailable</span>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 md:p-6 overflow-hidden">
                <div className="relative w-full" style={{ paddingBottom: '60%' }}>
                  <svg
                    viewBox="0 0 1000 600"
                    className="absolute inset-0 w-full h-full"
                    style={{ fontFamily: 'sans-serif' }}
                  >
                    {/* Restaurant Outline */}
                    <rect x="20" y="20" width="960" height="560" rx="8" fill="#FAFAFA" stroke="#374151" strokeWidth="3" />

                    {/* Windows (left side) */}
                    {[100, 180, 260, 340].map((yPos) => (
                      <rect key={`window-${yPos}`} x="20" y={yPos} width="6" height="50" fill="#93C5FD" rx="2" />
                    ))}

                    {/* Entrance (bottom center) */}
                    <g>
                      <rect x="450" y="565" width="100" height="15" fill="#374151" rx="2" />
                      <text x="500" y="577" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">ENTRANCE</text>
                    </g>

                    {/* Kitchen (top right) */}
                    <rect x="780" y="20" width="200" height="100" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" strokeDasharray="5,3" />
                    <text x="880" y="75" textAnchor="middle" fill="#92400E" fontSize="14" fontWeight="bold">KITCHEN</text>

                    {/* Bar Area */}
                    <rect x="250" y="420" width="250" height="120" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="4,3" rx="6" />
                    <text x="375" y="445" textAnchor="middle" fill="#5B21B6" fontSize="12" fontWeight="bold">BAR</text>
                    <rect x="270" y="460" width="210" height="8" fill="#7C3AED" rx="4" />

                    {/* WC (top left) */}
                    <rect x="20" y="20" width="80" height="60" fill="#F3F4F6" stroke="#6B7280" strokeWidth="1.5" rx="4" />
                    <text x="60" y="55" textAnchor="middle" fill="#4B5563" fontSize="12" fontWeight="bold">WC</text>

                    {/* VIP Area (right side) */}
                    <rect x="650" y="140" width="310" height="280" fill="#FDF2F8" stroke="#EC4899" strokeWidth="1.5" strokeDasharray="6,3" rx="6" />
                    <text x="805" y="165" textAnchor="middle" fill="#9D174D" fontSize="13" fontWeight="bold">VIP AREA</text>

                    {/* Terrace (bottom right) */}
                    {restaurant.outdoorSeating && (
                      <>
                        <rect x="550" y="420" width="410" height="140" fill="#ECFDF5" stroke="#059669" strokeWidth="1.5" strokeDasharray="6,3" rx="6" />
                        <text x="755" y="445" textAnchor="middle" fill="#065F46" fontSize="12" fontWeight="bold">TERRACE</text>
                      </>
                    )}

                    {/* Tables */}
                    {restaurant.tables.map((table) => {
                      const status = getTableStatus(table);
                      const color = getTableColor(status);
                      const cx = (table.x / 100) * 960 + 20;
                      const cy = (table.y / 100) * 560 + 20;
                      const isCircle = table.capacity <= 2;
                      const isHovered = hoveredTable === table.id;

                      return (
                        <g
                          key={table.id}
                          onClick={() => handleTableSelect(table)}
                          onMouseEnter={() => setHoveredTable(table.id)}
                          onMouseLeave={() => setHoveredTable(null)}
                          style={{ cursor: status === 'available' || status === 'selected' ? 'pointer' : 'not-allowed' }}
                        >
                          {isCircle ? (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isHovered ? 24 : 22}
                              fill={color}
                              stroke={isHovered ? '#1F2937' : 'transparent'}
                              strokeWidth="2"
                              opacity={status === 'disabled' ? 0.5 : 1}
                            />
                          ) : (
                            <rect
                              x={cx - (isHovered ? 28 : 26)}
                              y={cy - (isHovered ? 20 : 18)}
                              width={isHovered ? 56 : 52}
                              height={isHovered ? 40 : 36}
                              rx="8"
                              fill={color}
                              stroke={isHovered ? '#1F2937' : 'transparent'}
                              strokeWidth="2"
                              opacity={status === 'disabled' ? 0.5 : 1}
                            />
                          )}
                          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="bold">
                            {table.number}
                          </text>

                          {isHovered && (
                            <g>
                              <rect x={cx - 55} y={cy - 52} width="110" height="28" rx="4" fill="#1F2937" opacity="0.9" />
                              <text x={cx} y={cy - 34} textAnchor="middle" fill="white" fontSize="11">
                                {status === 'occupied'
                                  ? 'Fully booked today'
                                  : `Table ${table.number} (${table.capacity} seats)`}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Timeline */}
          {activeStep === 'time' && (
            <motion.div
              key="time-step"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <button
                onClick={goBack}
                className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 mb-4 min-h-[44px] px-2 rounded-lg transition-colors"
              >
                <FiArrowLeft size={18} />
                <span className="text-sm font-medium">Back to table selection</span>
              </button>

              <p className="text-sm text-gray-500 mb-4">
                {formatDateDisplay(selectedDate)} &middot; {guestCount} {guestCount === 1 ? 'guest' : 'guests'} &middot; Table {selectedTable.number} ({selectedTable.capacity} seats)
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">4</span>
                Select a Time Slot
              </h2>

              <p className="text-sm text-gray-500 mb-4">
                Reservation duration: 1.5 hours
              </p>

              {/* Timeline Legend */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-400" />
                  <span className="text-sm text-gray-600">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-400" />
                  <span className="text-sm text-gray-600">Reserved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-orange-400" />
                  <span className="text-sm text-gray-600">Kitchen Closed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-700" />
                  <span className="text-sm text-gray-600">Closed</span>
                </div>
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
                        case 'available':
                          bgColor = 'bg-emerald-400 hover:bg-emerald-500';
                          isClickable = true;
                          break;
                        case 'reserved':
                          bgColor = 'bg-red-400';
                          break;
                        case 'kitchen-closed':
                          bgColor = 'bg-orange-400';
                          break;
                        case 'closed':
                          bgColor = 'bg-gray-700';
                          break;
                        default:
                          bgColor = 'bg-gray-300';
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

                  {/* Time labels */}
                  <div className="flex mt-2">
                    {timeSlots
                      .filter((_, idx) => idx % 2 === 0)
                      .map((slotStart, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-gray-500"
                          style={{ width: `${(100 / timeSlots.length) * 2}%` }}
                        >
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
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMenuModal(false)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">{restaurant.name} - Menu</h3>
                <button
                  onClick={() => setShowMenuModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close menu"
                >
                  <FiX size={20} />
                </button>
              </div>

              {menuItems.map((section) => (
                <div key={section.category} className="mb-6 last:mb-0">
                  <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wide mb-3 border-b border-gray-100 pb-2">
                    {section.category}
                  </h4>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between py-1">
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
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <FiAlertTriangle className="text-yellow-600" size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Warning</h3>
                <button
                  onClick={() => { setShowWarningModal(false); setPendingTime(null); }}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  <FiX size={20} />
                </button>
              </div>
              <p className="text-gray-600 mb-6">
                This reservation is close to the restaurant's closing time. The restaurant closes at{' '}
                <span className="font-semibold">{restaurant.closingTime}</span>. Are you sure you want to continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowWarningModal(false); setPendingTime(null); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors min-h-[44px]"
                >
                  Choose Another Time
                </button>
                <button
                  onClick={() => confirmTimeSelection(pendingTime)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors min-h-[44px]"
                >
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
