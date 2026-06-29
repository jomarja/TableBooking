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
  FiExternalLink,
} from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { DashboardSummary } from '../types';
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

  const load = useCallback(async () => {
    try {
      const [summary, weekData] = await Promise.all([
        api.dashboard(selectedDate),
        api.dashboardWeek(weekStart),
      ]);
      setData(summary);
      setWeek(weekData.days);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [selectedDate, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const isToday = selectedDate === todayStr();
  // Step the whole view (visible week + selected day) forward/back a week.
  const stepWeek = (delta: number) => {
    setWeekStart((w) => addDays(w, delta * 7));
    setSelectedDate((d) => addDays(d, delta * 7));
  };
  const resetToThisWeek = () => {
    setWeekStart(mondayOf(todayStr()));
    setSelectedDate(todayStr());
  };

  if (error) {
    return <div className="text-red-500">Failed to load dashboard: {error}</div>;
  }
  if (!data) {
    return <div className="text-slate-400">Loading dashboard…</div>;
  }

  const s = data.stats;
  const cards = [
    { label: isToday ? "Today's Reservations" : 'Reservations', value: s.todayReservations, icon: FiCalendar, color: 'indigo' },
    { label: 'Expected Guests', value: s.expectedGuests, icon: FiUsers, color: 'emerald' },
    { label: 'Occupancy', value: `${s.occupancy}%`, icon: FiTrendingUp, color: 'blue' },
    { label: 'Upcoming Arrivals', value: s.upcomingArrivals, icon: FiClock, color: 'amber' },
    { label: 'Blocked Periods', value: s.blockedPeriods, icon: FiSlash, color: 'orange' },
    { label: 'Available Tables', value: `${s.availableTables}/${s.totalTables}`, icon: FiCheckSquare, color: 'slate' },
  ];
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
          <WeekOverview days={week} selectedDate={selectedDate} today={todayStr()} onSelect={setSelectedDate} />
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorMap[c.color]}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-800">{c.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
            </div>
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
                Open in scheduler <FiExternalLink size={12} />
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto tb-scroll">
            {data.todayReservations.length === 0 && (
              <p className="px-5 py-8 text-center text-slate-400 text-sm">
                No reservations {isToday ? 'today' : `on ${fmtShort(selectedDate)}`}.
              </p>
            )}
            {data.todayReservations.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {r.name} {r.surname}{' '}
                    <span className="text-slate-400 font-normal">· {r.guests} guests</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.startTime}–{r.endTime}
                    {r.occasion ? ` · ${r.occasion}` : ''}
                  </p>
                </div>
                {statusBadge(r.status)}
              </div>
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
                <div key={r.id} className="px-5 py-2.5">
                  <p className="text-sm font-medium text-slate-700">
                    {r.name} {r.surname}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.date} · {r.startTime} · {r.guests} guests
                  </p>
                </div>
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
              {data.recentActivity.map((a) => (
                <div key={a.id} className="px-5 py-2.5 text-xs">
                  <span className="font-medium text-slate-700 capitalize">
                    {a.action.replace(/_/g, ' ')}
                  </span>
                  {a.customer && <span className="text-slate-500"> · {a.customer}</span>}
                  <span className="text-slate-400 block">
                    {new Date(a.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
