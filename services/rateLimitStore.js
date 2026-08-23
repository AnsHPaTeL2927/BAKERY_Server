const prisma = require('../config/prisma');

// A shared store for express-rate-limit, backed by the Postgres database the
// app already uses.
//
// The default store keeps counters in process memory. That is fine for one
// long-lived server, but on Vercel each serverless invocation may run in a
// fresh instance with its own memory, so the counters scatter and the limits
// stop binding in any useful way. Every instance reads and writes the same rows
// here instead.
//
// Redis (Upstash/@vercel/kv) would be the lower-latency choice at higher
// traffic; it is a drop-in replacement for this class if that day comes.
class PostgresRateLimitStore {
  constructor() {
    this.windowMs = 60_000;
  }

  // Called by express-rate-limit once per limiter, handing over that limiter's
  // configuration. `prefix` keeps each limiter's counters separate so a login
  // attempt and a contact-form post never share a budget.
  init(options) {
    this.windowMs = options.windowMs;
  }

  buildKey(key) {
    return `${this.prefix || 'rl'}:${key}`;
  }

  // The whole point of this store is correctness when several invocations hit
  // the same key at once, so the read-modify-write happens in one statement
  // rather than as a SELECT followed by an UPDATE. The CASE arms restart the
  // window in the same breath as the increment: a lapsed row is reset to 1
  // instead of being counted on top of the previous window.
  async increment(key) {
    const fullKey = this.buildKey(key);
    const expiresAt = new Date(Date.now() + this.windowMs);

    try {
      const rows = await prisma.$queryRaw`
        INSERT INTO rate_limit_hits ("key", "count", "expiresAt")
        VALUES (${fullKey}, 1, ${expiresAt})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN rate_limit_hits."expiresAt" <= NOW() THEN 1
            ELSE rate_limit_hits."count" + 1
          END,
          "expiresAt" = CASE
            WHEN rate_limit_hits."expiresAt" <= NOW() THEN ${expiresAt}
            ELSE rate_limit_hits."expiresAt"
          END
        RETURNING "count", "expiresAt"
      `;

      const row = rows[0];
      return { totalHits: Number(row.count), resetTime: row.expiresAt };
    } catch (err) {
      // Fail open. A database blip must not turn every request on the site into
      // an error — losing rate limiting for the duration is the lesser harm,
      // and the login lockout in authController is enforced separately from
      // this store either way.
      console.error(`[rate-limit] store unavailable, allowing request: ${err.message}`);
      return { totalHits: 1, resetTime: expiresAt };
    }
  }

  // Used by skipSuccessfulRequests/skipFailedRequests. Never drops below zero.
  async decrement(key) {
    try {
      await prisma.$executeRaw`
        UPDATE rate_limit_hits
        SET "count" = GREATEST("count" - 1, 0)
        WHERE "key" = ${this.buildKey(key)}
      `;
    } catch (err) {
      console.error(`[rate-limit] decrement failed: ${err.message}`);
    }
  }

  async resetKey(key) {
    try {
      await prisma.rateLimitHit.deleteMany({ where: { key: this.buildKey(key) } });
    } catch (err) {
      console.error(`[rate-limit] resetKey failed: ${err.message}`);
    }
  }
}

// Rows are only meaningful inside their window, so anything past it is dead
// weight. Called from the daily cron job.
async function cleanupExpiredRateLimits() {
  const { count } = await prisma.rateLimitHit.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return { deleted: count };
}

// Each limiter gets its own instance: express-rate-limit calls init() on the
// store it is given, so sharing one object between limiters would leave them
// all using whichever windowMs was registered last.
function createRateLimitStore(prefix) {
  const store = new PostgresRateLimitStore();
  store.prefix = prefix;
  return store;
}

module.exports = { createRateLimitStore, cleanupExpiredRateLimits, PostgresRateLimitStore };
