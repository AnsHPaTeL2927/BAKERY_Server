const express = require('express');
const { requireAdminAuth } = require('../../middleware/auth');

const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const categoriesRoutes = require('./categories.routes');
const productsRoutes = require('./products.routes');
const galleryRoutes = require('./gallery.routes');
const bannersRoutes = require('./banners.routes');
const offersRoutes = require('./offers.routes');
const settingsRoutes = require('./settings.routes');
const testimonialsRoutes = require('./testimonials.routes');
const messagesRoutes = require('./messages.routes');
const ordersRoutes = require('./orders.routes');

const router = express.Router();

// Auth routes handle their own per-endpoint auth requirements (login/verify/resend/refresh
// are public but rate-limited; /me and /logout require a valid session individually).
router.use('/auth', authRoutes);

// Everything below requires a valid admin session.
router.use(requireAdminAuth);

router.use('/dashboard', dashboardRoutes);
router.use('/categories', categoriesRoutes);
router.use('/products', productsRoutes);
router.use('/gallery', galleryRoutes);
router.use('/banners', bannersRoutes);
router.use('/offers', offersRoutes);
router.use('/settings', settingsRoutes);
router.use('/testimonials', testimonialsRoutes);
router.use('/messages', messagesRoutes);
router.use('/orders', ordersRoutes);

module.exports = router;
