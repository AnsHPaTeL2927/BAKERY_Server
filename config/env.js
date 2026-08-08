require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  PUBLIC_ASSET_URL: z.string().url().optional(),

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
if (!data.PUBLIC_ASSET_URL) {
  data.PUBLIC_ASSET_URL = `http://localhost:${data.PORT}`;
}

module.exports = data;
