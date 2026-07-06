import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCalendar,
  FiUsers,
  FiTrendingUp,
  FiClock,
  FiSlash,
  FiCheckSquare,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { DashboardSummary, ReservationStatus } from '../types';
import { statusBadge } from '../components/statusBadge';
import { OnlineReservationsQueue } from '../components/OnlineReservationsQueue';
import { WeekOverview } from '../components/WeekOverview';

type WeekDay = {
  date: string;
  weekday: string;
  reservations: number;
  guests: number;
  closed: boolean;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, n: number) => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (date: string) => {
  const d = new Date(date + 'T00:00:00Z');
  const wd = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(date, -wd);
};
const fmtFull = (ds: string) =>
  new Date(ds + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
const fmtShort = (ds: string) =>
  new Date(ds + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function DashboardPage() {
  const { restaurant } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [error, setError] = useState('');
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayStr()));
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  // What to show in the day's reservation list — All or a single status.
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'ALL'>('ALL');

  const load = useCallback(async () => {
    try {
      const [summary, weekData] = await Promise.all([
        api.dashboard(selectedDate),
        api.dashboardWeek(weekStart),
      ]);
      setData(summary);
      setWeek(weekData.days);
      // If a reload removed the last reservation of the actively-filtered
      // status (e.g. it was just approved), fall back to All so the chip row
      // never strands in a "nothing selected" state.
      setStatusFilter((f) =>
        f !== 'ALL' && !summary.todayReservations.some((r) => r.status === f) ? 'ALL' : f,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [selectedDate, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const isToday = selectedDate === todayStr();
  // Changing the day always resets the status filter, so the list is never
  // silently empty because of a leftover filter.
  const selectDay = (d: string) => {
    setSelectedDate(d);
    setStatusFilter('ALL');
  };
  // Step the whole view (visible week + selected day) forward/back a week.
  const stepWeek = (delta: number) => {
    setWeekStart((w) => addDays(w, delta * 7));
    setSelectedDate((d) => addDays(d, delta * 7));
    setStatusFilter('ALL');
  };
  const resetToThisWeek = () => {
    setWeekStart(mondayOf(todayStr()));
    selectDay(todayStr());
  };

  if (error) {
    return <div className="text-red-500">Failed to load dashboard: {error}</div>;
  }
  if (!data) {
    return <div className="text-slate-400">Loading dashboard…</div>;
  }

  const s = data.stats;
  const schedulerUrl = `/reservations?date=${selectedDate}`;
  // Every card is a shortcut — it opens the page where that number lives.
  const cards = [
    { label: isToday ? "Today's Reservations" : 'Reservations', value: s.todayReservations, icon: FiCalendar, color: 'indigo', to: schedulerUrl, hint: 'See the timeline' },
    { label: 'Expected Guests', value: s.expectedGuests, icon: FiUsers, color: 'emerald', to: schedulerUrl, hint: 'See the timeline' },
    { label: 'Occupancy', value: `${s.occupancy}%`, icon: FiTrendingUp, color: 'blue', to: schedulerUrl, hint: 'See tables in use' },
    { label: 'Upcoming Arrivals', value: s.upcomingArrivals, icon: FiClock, color: 'amber', to: schedulerUrl, hint: 'See arrivals' },
    { label: 'Blocked Periods', value: s.blockedPeriods, icon: FiSlash, color: 'orange', to: '/blocked', hint: 'Manage blocks' },
    { label: 'Available Tables', value: `${s.availableTables}/${s.totalTables}`, icon: FiCheckSquare, color: 'slate', to: '/floor-plan', hint: 'Open floor plan' },
  ];

  // Status filter chips for the day's list (only statuses that exist show up).
  const statusCounts = data.todayReservations.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  // CANCELLED is future-proofing: the summary endpoint currently excludes
  // cancelled rows, so that chip only appears if the server ever includes them.
  const STATUS_ORDER: { value: ReservationStatus; label: string }[] = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'SEATED', label: 'Arrived' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];
  const visibleReservations =
    statusFilter === 'ALL'
      ? data.todayReservations
      : data.todayReservations.filter((r) => r.status === statusFilter);
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    orange: 'bg-orange-50 text-orange-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Operations Overview</h2>
        <p className="text-slate-500 text-sm">
          {fmtFull(selectedDate)}
          {isToday && ' · Today'}
          {!restaurant?.published && ' · This restaurant is not published yet'}
        </p>
      </div>

      {/* Week demand overview — navigate weeks; click a day to load it below */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-600">
            Demand · {fmtShort(weekStart)} – {fmtShort(addDays(weekStart, 6))}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => stepWeek(-1)}
              aria-label="Previous week"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <FiChevronLeft />
            </button>
            <button
              onClick={resetToThisWeek}
              className="px-3 h-8 rounded-lg border border-slate-200 text-sm font-medium text-indigo-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              This week
            </button>
            <button
              onClick={() => stepWeek(1)}
              aria-label="Next week"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
        {week.length > 0 ? (
          <WeekOverview days={week} selectedDate={selectedDate} today={todayStr()} onSelect={selectDay} />
        ) : (
          <p className="text-sm text-slate-400">No data for this week.</p>
        )}
      </div>

      {/* Online reservation approval queue — the operational inbox */}
      <OnlineReservationsQueue
        pending={data.pendingOnline}
        restaurant={restaurant}
        onChanged={load}
      />

      {/* Stat cards — each one opens the page where that number lives */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => navigate(c.to)}
              title={c.hint}
              className="group text-left bg-white rounded-xl border border-slate-200 p-4 transition-all hover:border-indigo-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorMap[c.color]}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-800">{c.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
              <p className="text-[11px] text-indigo-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {c.hint} →
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's reservations */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">
              {isToday ? "Today's Reservations" : `Reservations · ${fmtShort(selectedDate)}`}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{data.todayReservations.length} total</span>
              <button
                onClick={() => navigate(`/reservations?date=${selectedDate}`)}
                className="text-xs font-medium text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                Open in scheduler <FiChevronRight size={13} />
              </button>
            </div>
          </div>
          {/* What to see — status filter chips (only statuses present that day) */}
          {data.todayReservations.length > 0 && (
            <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap gap-1.5">
              <button
                onClick={() => setStatusFilter('ALL')}
                aria-pressed={statusFilter === 'ALL'}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  statusFilter === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({data.todayReservations.length})
              </button>
              {STATUS_ORDER.filter((st) => statusCounts[st.value]).map((st) => (
                <button
                  key={st.value}
                  onClick={() => setStatusFilter(statusFilter === st.value ? 'ALL' : st.value)}
                  aria-pressed={statusFilter === st.value}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    statusFilter === st.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label} ({statusCounts[st.value]})
                </button>
              ))}
            </div>
          )}
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto tb-scroll">
            {data.todayReservations.length === 0 && (
              <p className="px-5 py-8 text-center text-slate-400 text-sm">
                No reservations {isToday ? 'today' : `on ${fmtShort(selectedDate)}`}.
              </p>
            )}
            {data.todayReservations.length > 0 && visibleReservations.length === 0 && (
              <p className="px-5 py-8 text-center text-slate-400 text-sm">
                No {STATUS_ORDER.find((st) => st.value === statusFilter)?.label.toLowerCase()} reservations —{' '}
                <button onClick={() => setStatusFilter('ALL')} className="text-indigo-600 hover:underline">
                  show all
                </button>
              </p>
            )}
            {visibleReservations.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/reservations?date=${r.date}&focus=${r.id}`)}
                title="Show in scheduler"
                className="group w-full text-left px-5 py-3 flex items-center justify-between gap-2 hover:bg-indigo-50/50 focus:outline-none focus-visible:bg-indigo-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {r.name} {r.surname}{' '}
                    <span className="text-slate-400 font-normal">· {r.guests} guests</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.startTime}–{r.endTime}
                    {r.occasion ? ` · ${r.occasion}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(r.status)}
                  <FiChevronRight
                    size={15}
                    className="text-slate-300 group-hover:text-indigo-500 transition-colors"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent activity + upcoming */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Upcoming</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto tb-scroll">
              {data.upcomingReservations.length === 0 && (
                <p className="px-5 py-6 text-center text-slate-400 text-sm">Nothing upcoming.</p>
              )}
              {data.upcomingReservations.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/reservations?date=${r.date}&focus=${r.id}`)}
                  title="Show in scheduler"
                  className="group w-full text-left px-5 py-2.5 flex items-center justify-between gap-2 hover:bg-indigo-50/50 focus:outline-none focus-visible:bg-indigo-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {r.name} {r.surname}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmtShort(r.date)} · {r.startTime} · {r.guests} guests
                    </p>
                  </div>
                  <FiChevronRight
                    size={14}
                    className="shrink-0 text-slate-300 group-hover:text-indigo-500 transition-colors"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Recent Activity</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto tb-scroll">
              {data.recentActivity.length === 0 && (
                <p className="px-5 py-6 text-center text-slate-400 text-sm">No recent activity.</p>
              )}
              {data.recentActivity.map((a) => {
                const linkable = !!(a.reservationId && a.date);
                const inner = (
                  <>
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700 capitalize">
                        {a.action.replace(/_/g, ' ')}
                      </span>
                      {a.customer && <span className="text-slate-500"> · {a.customer}</span>}
                      <span className="text-slate-400 block">
                        {new Date(a.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {linkable && (
                      <FiChevronRight
                        size={14}
                        className="shrink-0 text-slate-300 group-hover:text-indigo-500 transition-colors"
                      />
                    )}
                  </>
                );
                return linkable ? (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/reservations?date=${a.date}&focus=${a.reservationId}`)}
                    title="Show this reservation in the scheduler"
                    className="group w-full text-left px-5 py-2.5 text-xs flex items-center justify-between gap-2 hover:bg-indigo-50/50 focus:outline-none focus-visible:bg-indigo-50 transition-colors"
                  >
                    {inner}
                  </button>
                ) : (
                  <div key={a.id} className="px-5 py-2.5 text-xs flex items-center justify-between gap-2">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
