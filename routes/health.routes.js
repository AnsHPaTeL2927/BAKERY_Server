const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

const startedAt = Date.now();

// Liveness probe. Deliberately does no I/O so an uptime pinger can hit it
// every few minutes (to keep a free-tier host from sleeping) without touching
// the database. `express.Router().get` also answers HEAD requests, which is
// what most uptime monitors send.
router.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe — same shape, but also verifies the database connection.
// Use this one sparingly (manual checks / deploy gates), not as the keep-alive
// target, since it opens a DB round-trip on every hit.
router.get('/health/db', async (_req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[health] database check failed:', err.message);
    res.status(503).json({ status: 'error', database: 'down', timestamp: new Date().toISOString() });
  }
});

module.exports = router;
