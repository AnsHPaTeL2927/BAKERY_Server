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
app.use(
  cors({
    // origin: env.FRONTEND_URL,
    origin: true,
    credentials: true,
  }),
);
app.use(hpp());
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(absolutizeUploads);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/admin', adminRoutes);
app.use('/api', publicApiLimiter, publicRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Cakes by Tulsi API running on http://localhost:${env.PORT}`);
});
