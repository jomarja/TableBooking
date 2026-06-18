// Shared floor-plan coordinate convention.
// All element/table positions & sizes are in a 0..100 relative space.
// The renderer maps that onto this fixed viewBox. Both the customer app
// and the portal builder use these exact values — there is no second format.

export const VIEWBOX_WIDTH = 1000;
export const VIEWBOX_HEIGHT = 600;

// Table status -> fill color. Customer-side, "blocked" is intentionally
// folded into the same red/occupied treatment as a reservation: a blocked
// table is simply un-bookable and looks identical to an occupied one.
export const TABLE_COLORS = {
  available: '#3B82F6', // blue
  selected: '#10B981', // green
  occupied: '#EF4444', // red
  blocked: '#EF4444', // red (customer view) — same as occupied
  disabled: '#D1D5DB', // gray
  // Portal-only: blocked bands are orange in the dashboard, handled there.
};

// Decor element styling (fill, stroke, text).
export const ELEMENT_STYLES = {
  kitchen: { fill: '#FEF3C7', stroke: '#D97706', text: '#92400E' },
  wc: { fill: '#F3F4F6', stroke: '#6B7280', text: '#4B5563' },
  bar: { fill: '#EDE9FE', stroke: '#7C3AED', text: '#5B21B6' },
  terrace: { fill: '#ECFDF5', stroke: '#059669', text: '#065F46' },
  entrance: { fill: '#374151', stroke: '#374151', text: '#FFFFFF' },
  ac: { fill: '#DBEAFE', stroke: '#3B82F6', text: '#1E40AF' },
  plant: { fill: '#DCFCE7', stroke: '#16A34A', text: '#166534' },
  window: { fill: '#93C5FD', stroke: '#3B82F6', text: '#1E3A8A' },
  door: { fill: '#FED7AA', stroke: '#EA580C', text: '#9A3412' },
  wall: { fill: '#9CA3AF', stroke: '#4B5563', text: '#1F2937' },
};

// Convert relative (0..100) X/Y to viewBox pixels.
export const toPxX = (x) => (x / 100) * VIEWBOX_WIDTH;
export const toPxY = (y) => (y / 100) * VIEWBOX_HEIGHT;
export const toRelX = (px) => (px / VIEWBOX_WIDTH) * 100;
export const toRelY = (py) => (py / VIEWBOX_HEIGHT) * 100;

// Palette of element types available in the builder.
export const PALETTE = [
  { type: 'table', label: 'Table', icon: '🍽️' },
  { type: 'window', label: 'Window', icon: '🪟' },
  { type: 'door', label: 'Door', icon: '🚪' },
  { type: 'wc', label: 'WC', icon: '🚻' },
  { type: 'kitchen', label: 'Kitchen', icon: '👨‍🍳' },
  { type: 'ac', label: 'AC', icon: '❄️' },
  { type: 'bar', label: 'Bar', icon: '🍸' },
  { type: 'wall', label: 'Wall', icon: '🧱' },
  { type: 'plant', label: 'Plant', icon: '🪴' },
  { type: 'terrace', label: 'Terrace', icon: '🌿' },
  { type: 'entrance', label: 'Entrance', icon: '🚏' },
];
