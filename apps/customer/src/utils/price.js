// Price helpers for the customer app.
//
// Restaurants store their average meal price as a human-readable `priceRange`
// string (e.g. "₾60-₾120"). These helpers parse that string for filtering and
// sorting, and define the buckets shown in the Price Range filter.

/** Parse a "₾60-₾120" style string into { min, max } numbers (null if absent). */
export function parsePriceRange(priceRange) {
  const nums = String(priceRange || '').match(/\d+/g)?.map(Number) || [];
  if (nums.length === 0) return { min: null, max: null };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: nums[0], max: nums[1] };
}

/** Selectable price-range buckets for the filter UI (all amounts in ₾). */
export const PRICE_BUCKETS = [
  { id: 'budget', label: '₾0–30', min: 0, max: 30 },
  { id: 'moderate', label: '₾30–60', min: 30, max: 60 },
  { id: 'upscale', label: '₾60–100', min: 60, max: 100 },
  { id: 'premium', label: '₾100+', min: 100, max: Infinity },
];

/** True when a restaurant's price range overlaps the given bucket. */
export function matchesBucket(priceRange, bucket) {
  const { min, max } = parsePriceRange(priceRange);
  if (min === null) return false;
  return min <= bucket.max && max >= bucket.min;
}
