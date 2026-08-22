const express = require('express');
const crypto = require('crypto');
const env = require('../config/env');
const { asyncHandler } = require('../middleware/errorHandler');
const { expireStaleOffers } = require('../services/offerExpiryService');

const router = express.Router();

// Vercel Cron invokes these over plain HTTPS, so the endpoint is public as far
// as the network is concerned and needs its own guard. Vercel sends
// `Authorization: Bearer <CRON_SECRET>` on every scheduled request; anything
// that does not match is refused.
//
// Compared with timingSafeEqual so a wrong secret cannot be recovered a byte
// at a time by measuring response times.
function requireCronSecret(req, res, next) {
  const secret = env.CRON_SECRET;

  // Without a configured secret the endpoint would be an open trigger for
  // anyone who guesses the path, so it stays closed instead of open.
  if (!secret) {
    res.status(503).json({ message: 'Cron is not configured' });
    return;
  }

  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expectedBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  next();
}

// Replaces the daily `cron.schedule('0 0 * * *', ...)` that index.js used to
// run in-process. Scheduled from vercel.json; also safe to call by hand.
router.get(
  '/expire-offers',
  requireCronSecret,
  asyncHandler(async (_req, res) => {
    const result = await expireStaleOffers();
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, ...result });
  }),
);

module.exports = router;
