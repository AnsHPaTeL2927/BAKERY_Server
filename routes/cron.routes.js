const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireOpsSecret } = require('../middleware/opsAuth');
const { expireStaleOffers } = require('../services/offerExpiryService');
const { cleanupExpiredRateLimits } = require('../services/rateLimitStore');

const router = express.Router();

// Replaces the daily `cron.schedule('0 0 * * *', ...)` that index.js used to
// run in-process. Scheduled from vercel.json; also safe to call by hand.
router.get(
  '/expire-offers',
  requireOpsSecret,
  asyncHandler(async (_req, res) => {
    const result = await expireStaleOffers();

    // Rate-limit rows are only meaningful inside their own window, so the
    // daily sweep rides along with the job that already runs.
    const rateLimits = await cleanupExpiredRateLimits();

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, ...result, rateLimits });
  }),
);

module.exports = router;
