import { NavLink, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  FiGrid,
  FiCalendar,
  FiMap,
  FiSlash,
  FiSettings,
  FiLogOut,
  FiMenu,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/reservations', label: 'Reservations', icon: FiCalendar },
  { to: '/floor-plan', label: 'Floor Plan', icon: FiMap },
  { to: '/blocked', label: 'Blocked Periods', icon: FiSlash },
  { to: '/settings', label: 'Settings', icon: FiSettings },
];

const SIDEBAR_KEY = 'tb_sidebarCollapsed';

export default function Shell({ children }: { children: ReactNode }) {
  const { restaurant, staff, logout } = useAuth();
  const navigate = useNavigate();

  // Collapsed sidebar — persisted. Defaults to collapsed on tablet/mobile
  // (< 1024px) so the scheduler gets the space; expanded on desktop.
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved !== null) return saved === '1';
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  });
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  // Ctrl/Cmd+B toggles the sidebar (VS Code / Linear / ChatGPT style).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar — fixed; slides fully off-screen when collapsed. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out ${
          collapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
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

      {/* Mobile drawer backdrop — only when open on small screens. */}
      {!collapsed && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={toggle} />
      )}

      {/* Main column — margin makes room for the sidebar on desktop; collapses
          to full width when hidden. min-w-0 so the wide timeline scrolls inside
          its own container instead of widening the page. */}
      <div
        className={`min-w-0 flex flex-col min-h-screen transition-[margin] duration-200 ease-in-out ${
          collapsed ? 'ml-0' : 'md:ml-60'
        }`}
      >
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Single, always-present toggle — shows/hides the sidebar on press. */}
            <button
              onClick={toggle}
              title="Toggle sidebar (Ctrl+B)"
              aria-label="Toggle sidebar"
              className="p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 shrink-0"
            >
              <FiMenu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-800 truncate">
                {restaurant?.name || 'Restaurant'}
              </h1>
              <p className="text-xs text-slate-400 truncate">{restaurant?.address}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
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
