// Traditional long-lived server entry point — used for local development and
// for any host that runs this as an ordinary Node process (Render, Railway,
// a VPS). Vercel does NOT use this file; it loads api/index.js instead and
// invokes the exported Express app per request.
//
// Everything that needs a persistent process lives here rather than in
// index.js, because on Vercel there is no such process: an in-process cron
// schedule would never fire, and a self-ping keep-alive would just burn
// invocations against a platform that never sleeps.
const env = require('./config/env');
const cron = require('node-cron');

const app = require('./index');
const { expireStaleOffers } = require('./services/offerExpiryService');
const { startKeepAlive } = require('./services/keepAliveService');

app.listen(env.PORT, () => {
  console.log(`Cakes by Tulsi API running on http://localhost:${env.PORT}`);
});

// Deactivate offers past their own `endDate` — public visibility is already
// date-aware on every request regardless of this job (see getOffers), so
// this only keeps the admin panel's "Active" toggle honest. Skipped in
// tests to avoid side effects against a test database.
if (env.NODE_ENV !== 'test') {
  expireStaleOffers().catch((err) => console.error('[offer-expiry] boot-time run failed:', err));
  cron.schedule('0 0 * * *', () => {
    expireStaleOffers().catch((err) => console.error('[offer-expiry] scheduled run failed:', err));
  });

  startKeepAlive();
}
