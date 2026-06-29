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

const dayMonth = (ds: string) =>
  new Date(ds + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * Week demand strip — click a day to load it into the overview below.
 * The selected day is ringed; today is badged.
 */
export function WeekOverview({
  days,
  selectedDate,
  today,
  onSelect,
}: {
  days: Day[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
      {days.map((d) => {
        const isToday = d.date === today;
        const isSel = d.date === selectedDate;
        const busy = !d.closed && d.guests > 0;
        return (
          <button
            key={d.date}
            onClick={() => onSelect(d.date)}
            aria-pressed={isSel}
            title={`View ${dayMonth(d.date)}`}
            className={`text-left rounded-xl border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isSel
                ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/50'
                : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className={`text-xs font-semibold ${isSel ? 'text-indigo-700' : 'text-slate-500'}`}>
                {SHORT[d.weekday] || d.weekday}
              </span>
              {isToday && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                  Today
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">{dayMonth(d.date)}</p>
            {d.closed ? (
              <p className="mt-2 text-sm font-semibold text-slate-400">Closed</p>
            ) : (
              <p className="mt-2 leading-none">
                <span className={`text-xl font-bold ${busy ? 'text-slate-800' : 'text-slate-300'}`}>
                  {d.guests}
                </span>
                <span className="text-xs text-slate-400"> / {d.reservations}</span>
              </p>
            )}
            {!d.closed && <p className="text-[10px] text-slate-400 mt-0.5">guests / bookings</p>}
          </button>
        );
      })}
    </div>
  );
}
