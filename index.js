const env = require('./config/env');
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const cron = require('node-cron');

const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public.routes');
const healthRoutes = require('./routes/health.routes');
const { publicApiLimiter } = require('./middleware/rateLimiters');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { absolutizeUploads } = require('./middleware/absolutizeUploads');
const { expireStaleOffers } = require('./services/offerExpiryService');
const { startKeepAlive } = require('./services/keepAliveService');

const app = express();

app.set('trust proxy', 1);

// Uploaded images are meant to be embedded from a different origin (the Vite
// dev server, and potentially a different domain in production), so the
// default same-origin resource policy would have browsers block every <img>
// load against /uploads.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = [
  env.FRONTEND_URL,
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

      const isAllowedOrigin = allowedOrigins.includes(origin) || /\.trycloudflare\.com$/i.test(origin);
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

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));
app.use(absolutizeUploads);

// Mounted at both paths so a pinger can target either the bare host or the
// same /api prefix the rest of the API uses. Registered before the public
// rate limiter so keep-alive traffic can never be throttled.
app.use(healthRoutes);
app.use('/api', healthRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api', publicApiLimiter, publicRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

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
