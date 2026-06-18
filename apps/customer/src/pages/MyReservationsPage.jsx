import { useReservation } from '../context/ReservationContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCalendar, FiUsers, FiClock, FiMapPin } from 'react-icons/fi';

export default function MyReservationsPage() {
  const { allReservations } = useReservation();

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Reservations</h1>

      {allReservations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCalendar className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No reservations yet</h2>
          <p className="text-gray-500 mb-6">Start by finding your perfect restaurant!</p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Browse Restaurants
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {allReservations.map((reservation, index) => (
            <motion.div
              key={reservation.reservationId || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {reservation.restaurant?.name || 'Restaurant'}
                  </h3>
                  <p className="text-sm text-emerald-600 font-medium mt-1">
                    ID: {reservation.reservationId}
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full">
                  Confirmed
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <FiCalendar className="w-4 h-4" />
                  <span className="text-sm">{formatDate(reservation.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <FiClock className="w-4 h-4" />
                  <span className="text-sm">
                    {reservation.timeSlot?.start} - {reservation.timeSlot?.end}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <FiUsers className="w-4 h-4" />
                  <span className="text-sm">{reservation.guests} guests</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <FiMapPin className="w-4 h-4" />
                  <span className="text-sm">Table {reservation.table?.number}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
