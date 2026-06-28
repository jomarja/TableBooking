import { useNavigate } from 'react-router-dom';

interface Day {
  date: string;
  weekday: string;
  reservations: number;
  guests: number;
  closed: boolean;
}

const SHORT: Record<string, string> = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
};

/** 7-day demand strip — click a day to jump to it in the scheduler. */
export function WeekOverview({ days }: { days: Day[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {days.map((d, i) => {
        const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : SHORT[d.weekday] || d.weekday;
        const busy = !d.closed && d.guests > 0;
        return (
          <button
            key={d.date}
            onClick={() => navigate(`/reservations?date=${d.date}`)}
            title={`Open ${d.date} in the scheduler`}
            className={`text-left bg-white rounded-xl border p-4 transition-colors hover:border-indigo-300 hover:shadow-sm ${
              i === 0 ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-slate-200'
            }`}
          >
            <p className="text-xs font-semibold text-slate-500 truncate">{label}</p>
            {d.closed ? (
              <p className="mt-2 text-sm font-semibold text-slate-400">Closed</p>
            ) : (
              <p className="mt-1 leading-none">
                <span className={`text-2xl font-bold ${busy ? 'text-slate-800' : 'text-slate-300'}`}>
                  {d.guests}
                </span>
                <span className="text-sm text-slate-400"> / {d.reservations}</span>
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              {d.closed ? d.date.slice(5) : 'guests / bookings'}
            </p>
          </button>
        );
      })}
    </div>
  );
}
