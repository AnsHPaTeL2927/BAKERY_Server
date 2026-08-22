const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many verification attempts. Please try again later.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts. Please try again later.' },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many messages sent. Please try again later.' },
});

// Reviews are public, unauthenticated and land in a moderation queue an admin
// has to clear by hand — a tighter budget than /contact so a single abusive
// visitor can't flood that queue.
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reviews submitted. Please try again later.' },
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests.' },
});

// The whole /api/admin tree, including the unauthenticated /auth/refresh.
// Generous enough for real dashboard use (which fans out into several parallel
// calls per page) while still bounding automated abuse.
const adminApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

// Refresh is unauthenticated (it only presents a refresh-token cookie), so it
// gets its own tighter budget on top of the tree-wide one.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many session refresh attempts. Please log in again.' },
});

const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
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
