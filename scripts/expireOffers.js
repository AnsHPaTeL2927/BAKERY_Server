// Manual/CLI entry point for the same expiry logic index.js already runs
// automatically at boot and nightly via node-cron (see
// services/offerExpiryService.js). Useful for testing, or for triggering a
// run on demand without waiting for the schedule.
//
// Usage: npm run expire-offers
const prisma = require('../config/prisma');
const { expireStaleOffers } = require('../services/offerExpiryService');

expireStaleOffers()
  .then(({ expired }) => {
    console.log(expired === 0 ? 'No offers needed expiring.' : `Done — ${expired} offer(s) expired.`);
  })
  .catch((err) => {
    console.error('Failed to expire offers:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
