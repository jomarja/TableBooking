import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiPhone, FiMail, FiMapPin, FiGift, FiMessageSquare, FiInfo, FiArrowLeft } from 'react-icons/fi';
import { useReservation } from '../context/ReservationContext';
import StepIndicator from '../components/StepIndicator';
import Select from '../components/Select';

export default function ReservationFormPage() {
  const { reservationData, updateReservation } = useReservation();
  const navigate = useNavigate();

  // Which contact fields to show/require comes from the restaurant's
  // Reservation Settings (carried in reservationData.config). Defaults keep the
  // classic behaviour when a restaurant hasn't customised anything.
  const rf = reservationData.config?.requiredFields || {};
  const notice = reservationData.config?.reservationNotice;
  const mode = (key, dflt) => rf[key] || dflt;
  const nameMode = mode('firstName', 'required');
  const surnameMode = mode('lastName', 'required');
  const phoneMode = mode('phone', 'required');
  const emailMode = mode('email', 'hidden');
  const addressMode = mode('address', 'hidden');
  const commentsMode = mode('comments', 'optional');

  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    phone: '',
    email: '',
    address: '',
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
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setFormData((prev) => ({ ...prev, phone: value }));
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: '' }));
    }
  };

  const validate = () => {
    const e = {};
    if (nameMode === 'required' && !formData.name.trim()) e.name = 'Name is required';
    if (surnameMode === 'required' && !formData.surname.trim()) e.surname = 'Surname is required';
    if (phoneMode !== 'hidden') {
      if (phoneMode === 'required' && (!formData.phone || formData.phone.length < 9)) {
        e.phone = 'Phone number must be at least 9 digits';
      } else if (formData.phone && formData.phone.length < 9) {
        e.phone = 'Phone number must be at least 9 digits';
      }
    }
    if (emailMode !== 'hidden') {
      const v = formData.email.trim();
      if (emailMode === 'required' && !v) e.email = 'Email is required';
      else if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) e.email = 'Enter a valid email address';
    }
    if (addressMode === 'required' && !formData.address.trim()) e.address = 'Address is required';
    if (commentsMode === 'required' && !formData.specialRequest.trim()) {
      e.specialRequest = 'This field is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      updateReservation('personalInfo', {
        name: formData.name,
        surname: formData.surname,
        phone: formData.phone ? '+995' + formData.phone : '',
        email: formData.email || undefined,
        address: formData.address || undefined,
        occasion: formData.occasion,
        specialRequest: formData.specialRequest,
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

  // Small label with a required asterisk or "(optional)" hint based on the mode.
  const labelExtra = (m) =>
    m === 'required' ? (
      <span className="text-red-500">*</span>
    ) : (
      <span className="text-gray-400 text-xs">(optional)</span>
    );

  const inputCls = (hasError) =>
    `w-full min-h-[48px] px-4 py-3 rounded-lg border ${
      hasError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'
    } focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-gray-900`;

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

          {/* Reservation notice from the restaurant (optional) */}
          {notice && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-6 text-sm">
              <FiInfo className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Personal Information</h2>
            <p className="text-gray-500 mb-6">Please provide your details to complete the reservation.</p>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Name */}
              {nameMode !== 'hidden' && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    <FiUser className="inline mr-1.5 -mt-0.5" />
                    Name {labelExtra(nameMode)}
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    aria-required={nameMode === 'required'}
                    aria-invalid={!!errors.name}
                    className={inputCls(!!errors.name)}
                    placeholder="Enter your name"
                    maxLength={100}
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-500" role="alert">{errors.name}</p>}
                </div>
              )}

              {/* Surname */}
              {surnameMode !== 'hidden' && (
                <div>
                  <label htmlFor="surname" className="block text-sm font-medium text-gray-700 mb-1">
                    <FiUser className="inline mr-1.5 -mt-0.5" />
                    Surname {labelExtra(surnameMode)}
                  </label>
                  <input
                    type="text"
                    id="surname"
                    name="surname"
                    value={formData.surname}
                    onChange={handleChange}
                    aria-required={surnameMode === 'required'}
                    aria-invalid={!!errors.surname}
                    className={inputCls(!!errors.surname)}
                    placeholder="Enter your surname"
                    maxLength={100}
                  />
                  {errors.surname && <p className="mt-1 text-sm text-red-500" role="alert">{errors.surname}</p>}
                </div>
              )}

              {/* Phone */}
              {phoneMode !== 'hidden' && (
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    <FiPhone className="inline mr-1.5 -mt-0.5" />
                    Phone Number {labelExtra(phoneMode)}
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
                      aria-required={phoneMode === 'required'}
                      aria-invalid={!!errors.phone}
                      className={`${inputCls(!!errors.phone)} rounded-l-none`}
                      placeholder="5XX XXX XXX"
                      maxLength={9}
                    />
                  </div>
                  {errors.phone && <p className="mt-1 text-sm text-red-500" role="alert">{errors.phone}</p>}
                </div>
              )}

              {/* Email */}
              {emailMode !== 'hidden' && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    <FiMail className="inline mr-1.5 -mt-0.5" />
                    Email {labelExtra(emailMode)}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    aria-required={emailMode === 'required'}
                    aria-invalid={!!errors.email}
                    className={inputCls(!!errors.email)}
                    placeholder="you@example.com"
                    maxLength={200}
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-500" role="alert">{errors.email}</p>}
                </div>
              )}

              {/* Address */}
              {addressMode !== 'hidden' && (
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    <FiMapPin className="inline mr-1.5 -mt-0.5" />
                    Address {labelExtra(addressMode)}
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    aria-required={addressMode === 'required'}
                    aria-invalid={!!errors.address}
                    className={inputCls(!!errors.address)}
                    placeholder="Street, city"
                    maxLength={300}
                  />
                  {errors.address && <p className="mt-1 text-sm text-red-500" role="alert">{errors.address}</p>}
                </div>
              )}

              {/* Special Occasion (always optional) */}
              <div>
                <label htmlFor="occasion" className="block text-sm font-medium text-gray-700 mb-1">
                  <FiGift className="inline mr-1.5 -mt-0.5" />
                  Special Occasion <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <Select
                  value={formData.occasion}
                  onChange={(v) =>
                    setFormData((prev) => ({ ...prev, occasion: v }))
                  }
                  options={[
                    { value: '', label: 'Select an occasion' },
                    ...occasions.map((occ) => ({ value: occ, label: occ })),
                  ]}
                  ariaLabel="Special Occasion"
                  className="w-full min-h-[48px]"
                />
              </div>

              {/* Special Request / Comments */}
              {commentsMode !== 'hidden' && (
                <div>
                  <label htmlFor="specialRequest" className="block text-sm font-medium text-gray-700 mb-1">
                    <FiMessageSquare className="inline mr-1.5 -mt-0.5" />
                    Special Request {labelExtra(commentsMode)}
                  </label>
                  <textarea
                    id="specialRequest"
                    name="specialRequest"
                    value={formData.specialRequest}
                    onChange={handleChange}
                    rows={3}
                    aria-required={commentsMode === 'required'}
                    aria-invalid={!!errors.specialRequest}
                    aria-label="Enter any special requests"
                    className={`${inputCls(!!errors.specialRequest)} resize-none`}
                    placeholder="Window table preferred, High chair required, Birthday cake..."
                    maxLength={2000}
                  />
                  {errors.specialRequest && <p className="mt-1 text-sm text-red-500" role="alert">{errors.specialRequest}</p>}
                </div>
              )}

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
