const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

process.env.POSTGRES_PRISMA_URL = process.env.POSTGRES_PRISMA_URL || 'postgresql://u:p@localhost:5432/db';
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED || 'postgresql://u:p@localhost:5432/db';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.OTP_SESSION_SECRET = 'c'.repeat(48);
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_USER = 'u';
process.env.SMTP_PASS = 'p';
process.env.SMTP_FROM = 'noreply@example.com';

// Stub the database so these run without one — the query itself is covered by
// the integration run against a real Postgres.
const prismaPath = require.resolve(path.join(__dirname, '..', 'config', 'prisma'));
const stub = { shouldThrow: false, calls: 0 };
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    async $queryRaw() {
      stub.calls += 1;
      if (stub.shouldThrow) throw new Error('connection terminated');
      return [{ count: 3, expiresAt: new Date(Date.now() + 60_000) }];
    },
    async $executeRaw() {},
    rateLimitHit: { deleteMany: async () => ({ count: 0 }) },
  },
};

const { createRateLimitStore } = require('../services/rateLimitStore');

test('rate limit store reports the shared counter', async () => {
  const store = createRateLimitStore('login');
  store.init({ windowMs: 60_000 });

  const result = await store.increment('1.2.3.4');
  assert.equal(result.totalHits, 3);
  assert.ok(result.resetTime instanceof Date);
});

test('each limiter namespaces its own counters', () => {
  const login = createRateLimitStore('login');
  const contact = createRateLimitStore('contact');

  assert.equal(login.buildKey('1.2.3.4'), 'login:1.2.3.4');
  assert.equal(contact.buildKey('1.2.3.4'), 'contact:1.2.3.4');
  assert.notEqual(login.buildKey('1.2.3.4'), contact.buildKey('1.2.3.4'));
});

test('a database failure fails open instead of erroring the request', async () => {
  const store = createRateLimitStore('login');
  store.init({ windowMs: 60_000 });

  stub.shouldThrow = true;
  const result = await store.increment('1.2.3.4');
  stub.shouldThrow = false;

  // Must resolve, not reject: an unreachable database should cost the site its
  // rate limiting, not every single request.
  assert.equal(result.totalHits, 1);
  assert.ok(result.resetTime instanceof Date);
});

test('each limiter gets its own store instance so windowMs is not shared', () => {
  const a = createRateLimitStore('a');
  const b = createRateLimitStore('b');
  a.init({ windowMs: 1000 });
  b.init({ windowMs: 5000 });

  assert.equal(a.windowMs, 1000);
  assert.equal(b.windowMs, 5000);
});
