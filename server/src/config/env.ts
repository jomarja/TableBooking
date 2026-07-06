import { join } from 'path';

/**
 * Central, validated environment access.
 *
 * Import these constants instead of reading `process.env` ad-hoc so that a
 * misconfigured deployment fails fast at boot instead of silently running with
 * insecure defaults. Nothing here has a production fallback for a secret.
 */

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** bcrypt work factor. 12 is the current sensible default for interactive auth. */
export const BCRYPT_ROUNDS = 12;

/**
 * JWT signing/verification secret.
 * - Production: MUST be provided and reasonably long, or the app refuses to boot.
 * - Development: a clearly-labelled local-only default keeps `npm run dev` working
 *   without ever shipping a real secret. This default is worthless in prod because
 *   prod throws when JWT_SECRET is missing.
 */
const DEV_ONLY_JWT_SECRET = 'dev-only-insecure-secret-not-for-production';
export const JWT_SECRET: string = (() => {
  const value = process.env.JWT_SECRET;
  if (IS_PRODUCTION) {
    if (!value || value.length < 32) {
      throw new Error(
        'JWT_SECRET must be set to a strong random value (>= 32 chars) in production. ' +
          'Generate one with:  openssl rand -hex 32',
      );
    }
    return value;
  }
  return value && value.length > 0 ? value : DEV_ONLY_JWT_SECRET;
})();

/** Access-token lifetime. Override with JWT_EXPIRES_IN (e.g. "24h", "7d"). */
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

/**
 * Allowed browser origins for CORS. Comma-separated `CORS_ORIGINS` in prod;
 * falls back to the local dev frontends when unset. Always an explicit allowlist
 * (never origin reflection) because credentials are enabled.
 */
export const CORS_ORIGINS: string[] = (
  process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5180', // local preview/verification instance
      ]
)
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Directory uploaded images are written to and served from. Point UPLOAD_DIR at a
 * mounted persistent disk in production — the default container filesystem on
 * most PaaS hosts (e.g. Render) is ephemeral and wiped on every deploy.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

/** Public base URL the API is reachable at, used to build absolute upload URLs. */
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
