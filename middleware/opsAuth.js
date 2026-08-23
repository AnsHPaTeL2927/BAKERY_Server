const crypto = require('crypto');
const env = require('../config/env');

// Shared guard for operational endpoints that are reachable over the public
// internet but are not for the public: the Vercel Cron trigger and the
// database readiness probe. Both authenticate with
// `Authorization: Bearer <CRON_SECRET>`, which is what Vercel Cron sends.
//
// Compared with timingSafeEqual so a wrong secret cannot be recovered a byte
// at a time by measuring response times.
function requireOpsSecret(req, res, next) {
  const secret = env.CRON_SECRET;

  // Without a configured secret these would be open triggers for anyone who
  // guesses the path, so they stay closed instead of open.
  if (!secret) {
    res.status(503).json({ message: 'Not configured' });
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

module.exports = { requireOpsSecret };
