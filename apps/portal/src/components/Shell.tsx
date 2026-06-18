import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  FiGrid,
  FiCalendar,
  FiMap,
  FiSlash,
  FiSettings,
  FiLogOut,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/reservations', label: 'Reservations', icon: FiCalendar },
  { to: '/floor-plan', label: 'Floor Plan', icon: FiMap },
  { to: '/blocked', label: 'Blocked Periods', icon: FiSlash },
  { to: '/settings', label: 'Settings', icon: FiSettings },
];

export default function Shell({ children }: { children: ReactNode }) {
  const { restaurant, staff, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-slate-300 flex-col hidden md:flex fixed inset-y-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <span className="text-lg font-bold text-white">TableBooker</span>
          <span className="ml-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
            Portal
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
          >
            <FiLogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main column — min-w-0 so wide content (e.g. the timeline) scrolls
          inside its own container instead of widening the whole page */}
      <div className="flex-1 min-w-0 md:ml-60 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              {restaurant?.name || 'Restaurant'}
            </h1>
            <p className="text-xs text-slate-400">{restaurant?.address}</p>
          </div>
          <div className="flex items-center gap-3">
            {restaurant && !restaurant.published && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                Not published
              </span>
            )}
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
              {(staff?.name || 'S').charAt(0)}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
