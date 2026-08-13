const prisma = require('../config/prisma');
const { logAction } = require('./auditService');

// The public site already hides expired offers on every request (see
// controllers/public/contentController.js#getOffers, which computes
// isCurrentlyActive/isExpired live against the clock) — that's what actually
// protects visitors, and it needs no cron to work correctly.
//
// This job exists purely for admin-panel bookkeeping: without it, an offer
// past its own `endDate` keeps showing as "Active" in the Offers list
// indefinitely unless a human remembers to toggle it off. Runs once at
// server boot (catches anything that expired while the server was down)
// and then on the configured cron schedule (see index.js).
async function expireStaleOffers() {
  const now = new Date();

  const stale = await prisma.offer.findMany({
    where: { active: true, endDate: { lt: now } },
    select: { id: true, festival: true, endDate: true },
  });

  if (stale.length === 0) return { expired: 0 };

  await prisma.offer.updateMany({
    where: { id: { in: stale.map((o) => o.id) } },
    data: { active: false },
  });

  await Promise.all(
    stale.map((offer) =>
      logAction({
        adminId: null,
        action: 'OFFER_AUTO_EXPIRED',
        entityType: 'Offer',
        entityId: offer.id,
        meta: { festival: offer.festival, endDate: offer.endDate },
      }),
    ),
  );

  console.log(`[offer-expiry] Deactivated ${stale.length} offer(s) past their end date: ${stale.map((o) => o.festival).join(', ')}`);
  return { expired: stale.length };
}

module.exports = { expireStaleOffers };
