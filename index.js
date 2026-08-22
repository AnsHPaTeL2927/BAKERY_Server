const env = require('./config/env');
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public.routes');
const healthRoutes = require('./routes/health.routes');
const cronRoutes = require('./routes/cron.routes');
const { publicApiLimiter } = require('./middleware/rateLimiters');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { absolutizeUploads } = require('./middleware/absolutizeUploads');

const app = express();

app.set('trust proxy', 1);

// Uploaded images are meant to be embedded from a different origin (the Vite
// dev server, and potentially a different domain in production), so the
// default same-origin resource policy would have browsers block every <img>
// load against /uploads.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = [
  ...env.FRONTEND_URLS,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost:5173',
  'https://127.0.0.1:5173',
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      // *.vercel.app covers the preview deployment each push generates, whose
      // hostname is not known ahead of time and so can never be listed in
      // FRONTEND_URL.
      const isAllowedOrigin =
        allowedOrigins.includes(origin) ||
        /\.trycloudflare\.com$/i.test(origin) ||
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
      callback(null, isAllowedOrigin);
    },
    credentials: true,
  }),
);
app.use(hpp());
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

if (env.NODE_ENV !== 'test') {
  // Health checks are hit on a short interval by the uptime pinger; logging
  // every one of them would bury the real request log.
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      skip: (req) => req.path === '/health' || req.path === '/api/health',
    }),
  );
}

// Invoices used to live under uploads/ and were therefore world-readable at a
// guessable URL (/uploads/invoices/INV-0001.pdf). They are no longer written to
// disk at all — they are rendered on demand behind
// GET /api/admin/orders/:id/invoice — but this guard stays so a leftover file
// or a future mistake can never re-expose them here.
app.use('/uploads/invoices', (_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Local development only. In production images live in Vercel Blob and are
// referenced by their own absolute URLs, and the serverless filesystem holds
// no uploads/ directory to serve from in any case.
if (env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));
}
app.use(absolutizeUploads);

// Mounted at both paths so a pinger can target either the bare host or the
// same /api prefix the rest of the API uses. Registered before the public
// rate limiter so keep-alive traffic can never be throttled.
app.use(healthRoutes);
app.use('/api', healthRoutes);

// Offer expiry used to run in-process via node-cron. A serverless deployment
// has no long-lived process to hold a schedule, so the job is exposed as an
// authenticated endpoint that Vercel Cron calls instead (see vercel.json).
// server.js still drives it with node-cron when running as a normal process.
app.use('/api/cron', cronRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api', publicApiLimiter, publicRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Exported rather than listened on: api/index.js hands this to Vercel as a
// serverless handler, and server.js starts a real listener for local
// development and any traditional (Render/Railway) host.
module.exports = app;
