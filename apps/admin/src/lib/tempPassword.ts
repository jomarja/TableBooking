/**
 * Generate a strong, readable temporary password (default 14 chars).
 *
 * Used when an admin creates a restaurant or resets an owner's password so we
 * never ship a guessable literal like "password". The owner is forced to change
 * it on first login (firstLogin flag), so this only needs to be unguessable and
 * easy to copy once. Ambiguous characters (0/O, 1/l/I) are excluded.
 */
export function tempPassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => alphabet[n % alphabet.length]).join('');
}
