require('dotenv').config();
const { z } = require('zod');

function splitOrigins(value) {
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const envSchema = z.object({
  // Vercel's Neon integration injects several connection strings under its
  // own names rather than a plain DATABASE_URL. schema.prisma reads
  // POSTGRES_PRISMA_URL (pooled, for the app) and DATABASE_URL_UNPOOLED
  // (direct, for migrations) itself — Prisma resolves `env()` independently
  // of this file — but both are validated here too so a missing one fails
  // loudly at boot with a clear message instead of a cryptic Prisma error on
  // the first query.
  POSTGRES_PRISMA_URL: z.string().min(1, 'POSTGRES_PRISMA_URL is required (the pooled Neon connection string)'),
  DATABASE_URL_UNPOOLED: z.string().min(1, 'DATABASE_URL_UNPOOLED is required (the direct Neon connection string, used for migrations)'),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Comma-separated list of allowed browser origins. A production site is
  // reachable at both the apex and the www host (and Vercel adds a
  // *.vercel.app preview origin), so this accepts several rather than one.
  FRONTEND_URL: z
    .string()
    .default('http://localhost:5173')
    .refine(
      (value) => splitOrigins(value).every(isHttpUrl),
      'FRONTEND_URL must be a comma-separated list of absolute http(s) URLs',
    ),
  PUBLIC_ASSET_URL: z.string().url().optional(),

  // Vercel Blob replaces the local uploads/ directory in production (a
  // serverless filesystem is read-only and wiped between invocations).
  // Injected automatically by Vercel once a Blob store is linked to the
  // project; left unset locally, where images still go to uploads/.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Shared secret for the Vercel Cron endpoint that replaces node-cron.
  // Vercel sends it as `Authorization: Bearer <CRON_SECRET>`.
  CRON_SECRET: z.string().optional(),

  // Self-ping keep-alive (see services/keepAliveService.js). Leave
  // KEEP_ALIVE_URL unset to disable — it should point at this deployment's own
  // public /health URL, e.g. https://api.example.com/health.
  KEEP_ALIVE_URL: z.string().url().optional(),
  KEEP_ALIVE_INTERVAL_MINUTES: z.coerce.number().min(1).default(10),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET is too short'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET is too short'),
  OTP_SESSION_SECRET: z.string().min(16, 'OTP_SESSION_SECRET is too short'),

  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  OTP_SESSION_TTL: z.string().default('10m'),
  OTP_TTL_MINUTES: z.coerce.number().default(10),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),

  // Only used by the one-off seed script to bootstrap the very first admin
  // account — ongoing login/password management lives entirely in the
  // database (Admin.passwordHash), so these are optional at runtime.
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

// In production this is the single source of truth for absolute asset URLs
// (middleware/absolutizeUploads.js no longer trusts the request's Host /
// X-Forwarded-Host headers there), so a missing value would silently emit
// localhost links for every image. Fail loudly at boot instead.
if (data.NODE_ENV === 'production' && !data.PUBLIC_ASSET_URL) {
  console.error('PUBLIC_ASSET_URL must be set in production (public origin of this API, e.g. https://api.example.com)');
  process.exit(1);
}

if (!data.PUBLIC_ASSET_URL) {
  data.PUBLIC_ASSET_URL = `http://localhost:${data.PORT}`;
}

// Images move to Vercel Blob in production; without a token every upload would
// fail at the point an admin tries to save a product, which is far too late to
// find out. Fail at boot instead, matching PUBLIC_ASSET_URL's behaviour above.
if (data.NODE_ENV === 'production' && !data.BLOB_READ_WRITE_TOKEN) {
  console.error(
    'BLOB_READ_WRITE_TOKEN must be set in production (link a Vercel Blob store to the project to have it injected automatically)',
  );
  process.exit(1);
}

// Parsed once here so request handling never re-splits the string.
data.FRONTEND_URLS = splitOrigins(data.FRONTEND_URL);

module.exports = data;
