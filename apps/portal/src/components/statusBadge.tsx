import type { ReservationStatus } from '../types';

const STATUS_STYLES: Record<ReservationStatus, string> = {
  PENDING: 'bg-orange-100 text-orange-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700',
  SEATED: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-slate-200 text-slate-600',
  CANCELLED: 'bg-slate-200 text-slate-500 line-through',
};

export const RESERVATION_STATUSES: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
];

export function statusBadge(status: ReservationStatus) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
