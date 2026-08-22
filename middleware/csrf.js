const crypto = require('crypto');
const { ApiError } = require('./errorHandler');

// Auth cookies are SameSite=None (the admin SPA and the API can sit on
// different origins), so the browser attaches them to cross-site requests and
// gives us no built-in CSRF protection. This is the standard double-submit
// defence: a random token is issued in a JS-readable cookie alongside the
// session, and every state-changing request must echo it back in a header.
//
// A cross-site attacker can make the browser send the cookie, but same-origin
// policy stops them from *reading* it, and a custom header forces a preflight
// their origin will fail — so they cannot produce a matching pair.
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Endpoints that run before a session exists (and therefore before a CSRF
// cookie can exist). None of them mutate data on behalf of a logged-in admin:
// each is separately rate-limited and requires a secret the attacker does not
// have (password, emailed OTP, reset code, or the refresh token itself).
const EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/verify',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
]);

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PATHS.has(req.path)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(new ApiError(403, 'Invalid or missing CSRF token. Please refresh the page and try again.'));
  }

  return next();
}

module.exports = { requireCsrfToken, generateCsrfToken, CSRF_COOKIE, CSRF_HEADER };
