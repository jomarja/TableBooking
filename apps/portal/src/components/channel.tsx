import { FiMonitor, FiPhone } from 'react-icons/fi';
import { FaWalking } from 'react-icons/fa';
import type { IconType } from 'react-icons';
import type { ReservationChannel } from '../types';

interface ChannelMeta {
  label: string;
  Icon: IconType;
  className: string;
}

// ONLINE → monitor (self-service customer app), PHONE → phone (called in),
// WALK_IN → walking person (walked in).
const CHANNELS: Record<ReservationChannel, ChannelMeta> = {
  ONLINE: { label: 'Online', Icon: FiMonitor, className: 'text-indigo-500' },
  PHONE: { label: 'Called', Icon: FiPhone, className: 'text-sky-500' },
  WALK_IN: { label: 'Walked in', Icon: FaWalking, className: 'text-emerald-500' },
};

export const RESERVATION_CHANNELS: ReservationChannel[] = ['ONLINE', 'PHONE', 'WALK_IN'];

export function channelMeta(channel: ReservationChannel): ChannelMeta {
  return CHANNELS[channel] ?? CHANNELS.ONLINE;
}

/** Small inline icon marking how the booking arrived. */
export function ChannelIcon({
  channel,
  size = 13,
  className = '',
}: {
  channel: ReservationChannel;
  size?: number;
  className?: string;
}) {
  const { label, Icon } = channelMeta(channel);
  return (
    <span title={label} aria-label={label} className={`inline-flex ${className}`}>
      <Icon size={size} />
    </span>
  );
}
