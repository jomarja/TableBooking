import { motion } from "framer-motion";
import { FiCheck } from "react-icons/fi";

const steps = [
  { number: 1, label: "Restaurant" },
  { number: 2, label: "Date" },
  { number: 3, label: "Guests" },
  { number: 4, label: "Table" },
  { number: 5, label: "Time" },
  { number: 6, label: "Confirmation" },
];

export default function StepIndicator({ currentStep }) {
  return (
    <nav aria-label="Reservation progress" className="w-full py-4">
      <ol className="flex items-center justify-between max-w-3xl mx-auto px-4">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;

          return (
            <li
              key={step.number}
              className="flex flex-col items-center relative flex-1"
              aria-current={isCurrent ? "step" : undefined}
            >
              {/* Connector line */}
              {index > 0 && (
                <div className="absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2">
                  <div className="h-full bg-gray-200 w-full" />
                  <motion.div
                    className="h-full bg-emerald-500 absolute top-0 left-0"
                    initial={{ width: "0%" }}
                    animate={{ width: isCompleted || isCurrent ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  />
                </div>
              )}

              {/* Step circle */}
              <motion.div
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-semibold transition-colors ${
                  isCompleted
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : isCurrent
                      ? "bg-white border-emerald-500 text-emerald-600"
                      : "bg-white border-gray-300 text-gray-400"
                }`}
                animate={
                  isCurrent
                    ? { scale: [1, 1.1, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.3 }}
              >
                {isCompleted ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <FiCheck size={14} />
                  </motion.span>
                ) : (
                  step.number
                )}
              </motion.div>

              {/* Label */}
              <span
                className={`mt-2 text-xs font-medium text-center hidden sm:block ${
                  isCurrent
                    ? "text-emerald-600"
                    : isCompleted
                      ? "text-gray-700"
                      : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
