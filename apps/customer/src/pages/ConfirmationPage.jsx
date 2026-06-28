import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiHome, FiList, FiCalendar, FiUsers, FiClock, FiHash } from 'react-icons/fi';
import { useReservation } from '../context/ReservationContext';
import StepIndicator from '../components/StepIndicator';

function ConfettiParticle({ delay, x, color }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{ backgroundColor: color, left: `${x}%` }}
      initial={{ opacity: 1, y: -20, scale: 1, rotate: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, 300, 500],
        x: [0, (Math.random() - 0.5) * 100],
        rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
        scale: [1, 1, 0.5],
      }}
      transition={{
        duration: 2.5,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

export default function ConfirmationPage() {
  const { reservationData, resetReservation } = useReservation();
  const navigate = useNavigate();
  // Manual/hybrid approval restaurants create the booking as PENDING — be
  // honest about that instead of claiming it's confirmed.
  const pending = reservationData.status === 'PENDING';
  const [showConfetti, setShowConfetti] = useState(true);

  const confettiColors = [
    '#10b981', '#059669', '#34d399', '#6ee7b7',
    '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6',
    '#ec4899', '#14b8a6',
  ];

  const confettiParticles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.8,
    x: Math.random() * 100,
    color: confettiColors[i % confettiColors.length],
  }));

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleBackToHome = () => {
    resetReservation();
    navigate('/');
  };

  const handleViewReservations = () => {
    navigate('/reservations');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 relative overflow-hidden">
      {/* Confetti Animation */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {confettiParticles.map(particle => (
              <ConfettiParticle
                key={particle.id}
                delay={particle.delay}
                x={particle.x}
                color={particle.color}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-lg mx-auto relative z-10">
        <StepIndicator currentStep={6} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8"
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
            {/* Success Checkmark */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.3 }}
              className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.5 }}
              >
                <FiCheck className="w-10 h-10 text-emerald-600" strokeWidth={3} />
              </motion.div>
            </motion.div>

            {/* Heading */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2"
            >
              {pending ? 'Reservation Request Received!' : 'Table Reserved Successfully!'}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-gray-500 mb-8"
            >
              {pending
                ? "Your request has been sent. The restaurant will confirm it shortly — you'll get an SMS once it's approved."
                : 'Your reservation has been confirmed.'}
            </motion.p>

            {/* Reservation Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-gray-50 rounded-xl p-5 mb-6 text-left border border-gray-100"
            >
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Reservation Details
              </h3>
              <div className="space-y-3">
                {reservationData.restaurant && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiHome className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Restaurant</span>
                      <span className="text-sm font-medium text-gray-800">
                        {reservationData.restaurant.name || reservationData.restaurant}
                      </span>
                    </div>
                  </div>
                )}

                {reservationData.table && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiHash className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Table Number</span>
                      <span className="text-sm font-medium text-gray-800">
                        #{reservationData.table.number || reservationData.table}
                      </span>
                    </div>
                  </div>
                )}

                {reservationData.date && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiCalendar className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Date</span>
                      <span className="text-sm font-medium text-gray-800">
                        {formatDate(reservationData.date)}
                      </span>
                    </div>
                  </div>
                )}

                {reservationData.timeSlot && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiClock className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Time</span>
                      <span className="text-sm font-medium text-gray-800">
                        {reservationData.timeSlot.start && reservationData.timeSlot.end
                          ? `${reservationData.timeSlot.start} - ${reservationData.timeSlot.end}`
                          : reservationData.timeSlot}
                      </span>
                    </div>
                  </div>
                )}

                {reservationData.guests && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiUsers className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Guests</span>
                      <span className="text-sm font-medium text-gray-800">
                        {reservationData.guests} {reservationData.guests === 1 ? 'guest' : 'guests'}
                      </span>
                    </div>
                  </div>
                )}

                {reservationData.reservationId && (
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FiHash className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Reservation ID</span>
                      <span className="text-sm font-bold text-gray-900 font-mono">
                        {reservationData.reservationId}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* SMS Notification Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-sm text-gray-500 mb-8"
            >
              Reservation information has been sent via SMS.
            </motion.p>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <motion.button
                onClick={handleBackToHome}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                aria-label="Back to Home"
                className="flex-1 min-h-[48px] py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <FiHome className="w-4 h-4" />
                Back to Home
              </motion.button>

              <motion.button
                onClick={handleViewReservations}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                aria-label="View My Reservations"
                className="flex-1 min-h-[48px] py-3 px-6 bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <FiList className="w-4 h-4" />
                View My Reservations
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
