// Price helpers for the portal.
//
// A restaurant's average meal price is stored as a human-readable `priceRange`
// string (e.g. "₾60-₾120"). Staff enter a min/max in the setup wizard and
// settings; these helpers convert between the structured min/max and the stored
// string, and derive the coarse `priceLevel` (1–4) kept for backwards compat.

const DEFAULT_RANGE = { min: 30, max: 60 };

/** Parse a "₾60-₾120" style string into { min, max } (defaults if absent). */
export function parsePriceRange(priceRange?: string): { min: number; max: number } {
  const nums = (priceRange || '').match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return { ...DEFAULT_RANGE };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: nums[0], max: nums[1] };
}

/** Format a min/max pair into the stored display string. */
export function formatPriceRange(min: number, max: number): string {
  return `₾${min}-₾${max}`;
}

/** Derive the coarse 1–4 price level from the upper bound of the range. */
export function priceLevelFromRange(max: number): number {
  if (max <= 40) return 1;
  if (max <= 80) return 2;
  if (max <= 120) return 3;
  return 4;
}
