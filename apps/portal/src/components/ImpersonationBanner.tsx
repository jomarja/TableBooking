import { FiEye, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

/**
 * Fixed top banner shown whenever an admin is "logged in as" a restaurant.
 * Self-rendering: returns null for a normal owner session. Pages that include
 * it should leave ~40px (h-10) of top clearance for the fixed bar.
 */
export default function ImpersonationBanner() {
  const { restaurant, impersonatedBy, exitImpersonation } = useAuth();
  if (!impersonatedBy) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-50 h-10 bg-amber-500 text-white flex items-center justify-between gap-3 px-4 text-sm shadow-md">
      <span className="flex items-center gap-2 min-w-0">
        <FiEye className="shrink-0" size={15} />
        <span className="truncate">
          You are currently logged in as <strong>{restaurant?.name}</strong>
          <span className="hidden sm:inline"> · impersonated by {impersonatedBy}</span>
        </span>
      </span>
      <button
        onClick={() => void exitImpersonation()}
        className="shrink-0 flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
      >
        <FiArrowLeft size={13} /> Exit Impersonation
      </button>
    </div>
  );
}
