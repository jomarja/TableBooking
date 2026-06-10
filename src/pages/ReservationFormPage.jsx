import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiPhone, FiGift, FiMessageSquare, FiArrowLeft } from 'react-icons/fi';
import { useReservation } from '../context/ReservationContext';
import StepIndicator from '../components/StepIndicator';

export default function ReservationFormPage() {
  const { reservationData, updateReservation } = useReservation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    phone: '',
    occasion: '',
    specialRequest: '',
  });

  const [errors, setErrors] = useState({});

  const occasions = [
    'Birthday',
    'Anniversary',
    'Business Meeting',
    'Date Night',
    'Graduation',
    'Other',
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setFormData(prev => ({ ...prev, phone: value }));
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.surname.trim()) {
      newErrors.surname = 'Surname is required';
    }
    if (!formData.phone || formData.phone.length < 9) {
      newErrors.phone = 'Phone number must be at least 9 digits';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      updateReservation('personalInfo', {
        ...formData,
        phone: '+995' + formData.phone,
      });
      navigate('/reservation/verify');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  const formatTimeSlot = (slot) => {
    if (!slot) return '';
    if (typeof slot === 'string') return slot;
    if (slot.start && slot.end) return `${slot.start} - ${slot.end}`;
    return '';
  };

  const handleBack = () => {
    if (reservationData.restaurant?.id) {
      navigate(`/restaurant/${reservationData.restaurant.id}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <StepIndicator currentStep={5} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-8"
        >
          {/* Back Button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 mb-6 min-h-[44px] px-2 rounded-lg transition-colors"
          >
            <FiArrowLeft size={18} />
            <span className="text-sm font-medium">Back to restaurant</span>
          </button>

          {/* Summary Panel */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-8">
            <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide mb-3">
              Your Reservation Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {reservationData.restaurant && (
                <div>
                  <span className="text-gray-500 block">Restaurant</span>
                  <span className="font-medium text-gray-800">
                    {reservationData.restaurant.name || reservationData.restaurant}
                  </span>
                </div>
              )}
              {reservationData.date && (
                <div>
                  <span className="text-gray-500 block">Date</span>
                  <span className="font-medium text-gray-800">{formatDate(reservationData.date)}</span>
                </div>
              )}
              {reservationData.guests && (
                <div>
                  <span className="text-gray-500 block">Guests</span>
                  <span className="font-medium text-gray-800">{reservationData.guests} {reservationData.guests === 1 ? 'guest' : 'guests'}</span>
                </div>
              )}
              {reservationData.table && (
                <div>
                  <span className="text-gray-500 block">Table</span>
                  <span className="font-medium text-gray-800">
                    Table #{reservationData.table.number || reservationData.table} ({reservationData.table.capacity} seats)
                  </span>
                </div>
              )}
              {reservationData.timeSlot && (
                <div>
                  <span className="text-gray-500 block">Time</span>
                  <span className="font-medium text-gray-800">{formatTimeSlot(reservationData.timeSlot)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Personal Information</h2>
            <p className="text-gray-500 mb-6">Please provide your details to complete the reservation.</p>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  <FiUser className="inline mr-1.5 -mt-0.5" />
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  aria-required="true"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  className={`w-full min-h-[48px] px-4 py-3 rounded-lg border ${
                    errors.name ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'
                  } focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-gray-900`}
                  placeholder="Enter your name"
                />
                {errors.name && (
                  <p id="name-error" className="mt-1 text-sm text-red-500" role="alert">{errors.name}</p>
                )}
              </div>

              {/* Surname */}
              <div>
                <label htmlFor="surname" className="block text-sm font-medium text-gray-700 mb-1">
                  <FiUser className="inline mr-1.5 -mt-0.5" />
                  Surname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="surname"
                  name="surname"
                  value={formData.surname}
                  onChange={handleChange}
                  aria-required="true"
                  aria-invalid={!!errors.surname}
                  aria-describedby={errors.surname ? 'surname-error' : undefined}
                  className={`w-full min-h-[48px] px-4 py-3 rounded-lg border ${
                    errors.surname ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'
                  } focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-gray-900`}
                  placeholder="Enter your surname"
                />
                {errors.surname && (
                  <p id="surname-error" className="mt-1 text-sm text-red-500" role="alert">{errors.surname}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  <FiPhone className="inline mr-1.5 -mt-0.5" />
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 min-h-[48px] bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-600 font-medium text-sm">
                    +995
                  </span>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    aria-required="true"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                    className={`w-full min-h-[48px] px-4 py-3 rounded-r-lg border ${
                      errors.phone ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'
                    } focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-gray-900`}
                    placeholder="5XX XXX XXX"
                    maxLength={9}
                  />
                </div>
                {errors.phone && (
                  <p id="phone-error" className="mt-1 text-sm text-red-500" role="alert">{errors.phone}</p>
                )}
              </div>

              {/* Special Occasion */}
              <div>
                <label htmlFor="occasion" className="block text-sm font-medium text-gray-700 mb-1">
                  <FiGift className="inline mr-1.5 -mt-0.5" />
                  Special Occasion <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <select
                  id="occasion"
                  name="occasion"
                  value={formData.occasion}
                  onChange={handleChange}
                  aria-label="Select a special occasion"
                  className="w-full min-h-[48px] px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors text-gray-900 bg-white"
                >
                  <option value="">Select an occasion</option>
                  {occasions.map(occ => (
                    <option key={occ} value={occ}>{occ}</option>
                  ))}
                </select>
              </div>

              {/* Special Request */}
              <div>
                <label htmlFor="specialRequest" className="block text-sm font-medium text-gray-700 mb-1">
                  <FiMessageSquare className="inline mr-1.5 -mt-0.5" />
                  Special Request <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea
                  id="specialRequest"
                  name="specialRequest"
                  value={formData.specialRequest}
                  onChange={handleChange}
                  rows={3}
                  aria-label="Enter any special requests"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors text-gray-900 resize-none"
                  placeholder="Window table preferred, High chair required, Birthday cake..."
                />
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Continue to Verification
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
