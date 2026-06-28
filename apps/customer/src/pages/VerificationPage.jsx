import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShield, FiLoader } from 'react-icons/fi';
import { useReservation } from '../context/ReservationContext';
import StepIndicator from '../components/StepIndicator';

export default function VerificationPage() {
  const { reservationData, updateReservation, confirmReservation } = useReservation();
  const navigate = useNavigate();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);

  const phoneNumber = reservationData.personalInfo?.phone || '+995 XXX XXX XXX';

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < 6; i++) {
        newCode[i] = pasted[i] || '';
      }
      setCode(newCode);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex].focus();
    }
  };

  const isCodeComplete = code.every(digit => digit !== '');

  const handleVerify = async () => {
    if (!isCodeComplete) return;

    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulated verification delay for UX
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      updateReservation('verified', true);
      // Only navigate on a genuine booking — if the restaurant's rules reject
      // it (group size, capacity, lead time, online disabled…), show why.
      await confirmReservation();
      navigate('/reservation/confirmation');
    } catch (e) {
      setError(
        e?.message ||
          'We could not complete your reservation. Please go back and try another time.',
      );
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setCode(['', '', '', '', '', '']);
    setError('');
    inputRefs.current[0].focus();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <StepIndicator currentStep={5} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-8"
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
            {/* Shield Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <FiShield className="w-8 h-8 text-emerald-600" />
            </motion.div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">SMS Verification</h2>
            <p className="text-gray-500 mb-2">
              We've sent a verification code to your phone number.
            </p>
            <p className="text-sm font-medium text-gray-700 mb-8">
              {phoneNumber}
            </p>

            {/* OTP Input Boxes */}
            <div
              className="flex justify-center gap-2 sm:gap-3 mb-4"
              role="group"
              aria-label="Verification code input"
            >
              {code.map((digit, index) => (
                <motion.input
                  key={index}
                  ref={el => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  aria-label={`Digit ${index + 1}`}
                  className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-lg border-2 ${
                    digit
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-300 bg-white'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-red-500 mb-4" role="alert">
                {error}
              </p>
            )}

            {/* Hint text */}
            <p className="text-xs text-gray-400 mb-6">
              For demo, enter any 6 digits (e.g., 123456)
            </p>

            {/* Verify Button */}
            <motion.button
              onClick={handleVerify}
              disabled={!isCodeComplete || isLoading}
              whileHover={isCodeComplete && !isLoading ? { scale: 1.01 } : {}}
              whileTap={isCodeComplete && !isLoading ? { scale: 0.98 } : {}}
              aria-label="Verify code"
              className={`w-full min-h-[48px] py-3 px-6 rounded-lg font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 flex items-center justify-center ${
                isCodeComplete && !isLoading
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </motion.button>

            {/* Resend link */}
            <button
              onClick={handleResend}
              className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium focus:outline-none focus:underline"
              aria-label="Resend verification code"
            >
              Didn't receive the code? Resend
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
