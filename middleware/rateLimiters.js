const rateLimit = require('express-rate-limit');
const { createRateLimitStore } = require('../services/rateLimitStore');

// Every limiter below shares its counters through the database rather than
// process memory — see services/rateLimitStore.js for why that matters on a
// serverless host. Each gets its own prefix so their budgets stay separate.
function sharedLimiter(prefix, options) {
  return rateLimit({
    store: createRateLimitStore(prefix),
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
  });
}

const loginLimiter = sharedLimiter('login', {
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const otpLimiter = sharedLimiter('otp', {
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { message: 'Too many verification attempts. Please try again later.' },
});

const passwordResetLimiter = sharedLimiter('pwreset', {
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: { message: 'Too many password reset attempts. Please try again later.' },
});

const contactLimiter = sharedLimiter('contact', {
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many messages sent. Please try again later.' },
});

// Reviews are public, unauthenticated and land in a moderation queue an admin
// has to clear by hand — a tighter budget than /contact so a single abusive
// visitor can't flood that queue.
const reviewLimiter = sharedLimiter('review', {
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: 'Too many reviews submitted. Please try again later.' },
});

const analyticsLimiter = sharedLimiter('analytics', {
  windowMs: 60 * 1000,
  limit: 120,
  message: { message: 'Too many requests.' },
});

// The whole /api/admin tree, including the unauthenticated /auth/refresh.
// Generous enough for real dashboard use (which fans out into several parallel
// calls per page) while still bounding automated abuse.
const adminApiLimiter = sharedLimiter('admin', {
  windowMs: 5 * 60 * 1000,
  limit: 600,
  message: { message: 'Too many requests. Please slow down.' },
});

// Refresh is unauthenticated (it only presents a refresh-token cookie), so it
// gets its own tighter budget on top of the tree-wide one.
const refreshLimiter = sharedLimiter('refresh', {
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: { message: 'Too many session refresh attempts. Please log in again.' },
});

const publicApiLimiter = sharedLimiter('public', {
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  message: { message: 'Too many requests. Please slow down.' },
});

module.exports = {
  loginLimiter,
  otpLimiter,
  passwordResetLimiter,
  contactLimiter,
  reviewLimiter,
  analyticsLimiter,
  adminApiLimiter,
  refreshLimiter,
  publicApiLimiter,
};
