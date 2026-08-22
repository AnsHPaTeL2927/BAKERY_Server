const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.POSTGRES_PRISMA_URL = process.env.POSTGRES_PRISMA_URL || 'postgresql://user:pass@localhost:5432/test';
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_PRISMA_URL;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.OTP_SESSION_SECRET = 'c'.repeat(48);
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_USER = 'user';
process.env.SMTP_PASS = 'pass';
process.env.SMTP_FROM = 'noreply@example.com';

const { requireCsrfToken, generateCsrfToken } = require('../middleware/csrf');
const { signAccessToken, verifyAccessToken, signOtpSessionToken, verifyOtpSessionToken } = require('../services/tokenService');

function runCsrf({ method, path, cookieToken, headerToken }) {
  const req = {
    method,
    path,
    cookies: cookieToken ? { csrf_token: cookieToken } : {},
    get: (name) => (name.toLowerCase() === 'x-csrf-token' ? headerToken : undefined),
  };

  let error = null;
  requireCsrfToken(req, {}, (err) => {
    error = err || null;
  });
  return error;
}

test('CSRF: state-changing admin requests need a matching cookie/header pair', () => {
  const token = generateCsrfToken();

  assert.equal(runCsrf({ method: 'POST', path: '/orders', cookieToken: token, headerToken: token }), null);
  assert.equal(runCsrf({ method: 'GET', path: '/orders' }), null, 'reads stay unrestricted');

  for (const attempt of [
    { method: 'POST', path: '/orders', cookieToken: token },
    { method: 'POST', path: '/orders', headerToken: token },
    { method: 'POST', path: '/orders', cookieToken: token, headerToken: generateCsrfToken() },
    { method: 'DELETE', path: '/products/1' },
    { method: 'PATCH', path: '/orders/1/status' },
  ]) {
    const err = runCsrf(attempt);
    assert.ok(err, `expected ${attempt.method} ${attempt.path} to be refused`);
    assert.equal(err.statusCode, 403);
  }
});

test('CSRF: pre-session auth endpoints are exempt', () => {
  for (const path of ['/auth/login', '/auth/verify', '/auth/resend-otp', '/auth/forgot-password', '/auth/reset-password', '/auth/refresh']) {
    assert.equal(runCsrf({ method: 'POST', path }), null, `${path} should be exempt`);
  }
  assert.ok(runCsrf({ method: 'POST', path: '/auth/logout' }), 'logout holds a session, so it is not exempt');
});

test('tokens: an OTP-session token can never be replayed as an access token', () => {
  const admin = { id: 1, email: 'admin@example.com' };

  assert.equal(verifyAccessToken(signAccessToken(admin)).sub, 1);
  assert.equal(verifyOtpSessionToken(signOtpSessionToken(admin.id)).sub, 1);

  // The purpose claim must be enforced independently of the signing secret —
  // that is the whole point, since reusing one secret is an easy config slip.
  const forged = jwt.sign({ sub: 1, purpose: 'admin-access' }, process.env.OTP_SESSION_SECRET, {
    expiresIn: '15m',
    issuer: 'cakes-by-tulsi-api',
  });
  assert.throws(() => verifyOtpSessionToken(forged), /Unexpected token purpose/);

  const purposeless = jwt.sign({ sub: 1 }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
    issuer: 'cakes-by-tulsi-api',
  });
  assert.throws(() => verifyAccessToken(purposeless), /Unexpected token purpose/);
});
