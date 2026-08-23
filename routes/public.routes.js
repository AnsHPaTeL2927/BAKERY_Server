const express = require('express');
const contentController = require('../controllers/public/contentController');
const contactController = require('../controllers/public/contactController');
const analyticsController = require('../controllers/public/analyticsController');
const reviewsController = require('../controllers/public/reviewsController');
const { validate } = require('../middleware/validate');
const { cachePublic } = require('../middleware/cacheControl');
const { contactLimiter, reviewLimiter, analyticsLimiter } = require('../middleware/rateLimiters');
const { createContactMessageSchema } = require('../validators/contactValidators');
const { createPublicReviewSchema } = require('../validators/testimonialValidators');
const { trackEventSchema } = require('../validators/trackValidators');

const router = express.Router();

// Catalog reads below are CDN-cached; the POST endpoints further down are not.
const cached = cachePublic({ seconds: 60, staleWhileRevalidate: 600 });

router.get('/products', cached, contentController.getProducts);
router.get('/categories', cached, contentController.getCategories);
router.get('/gallery', cached, contentController.getGallery);
router.get('/offers', cached, contentController.getOffers);
router.get('/settings', cached, contentController.getSettings);
router.get('/about', cached, contentController.getAbout);
router.get('/testimonials', cached, contentController.getTestimonials);
router.get('/hero-banners', cached, contentController.getHeroBanners);

router.post('/contact', contactLimiter, validate(createContactMessageSchema), contactController.create);
router.post('/reviews', reviewLimiter, validate(createPublicReviewSchema), reviewsController.create);
router.post('/analytics/track', analyticsLimiter, validate(trackEventSchema), analyticsController.trackEvent);

module.exports = router;
