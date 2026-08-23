const express = require('express');
const contentController = require('../controllers/public/contentController');
const contactController = require('../controllers/public/contactController');
const analyticsController = require('../controllers/public/analyticsController');
const reviewsController = require('../controllers/public/reviewsController');
const { validate } = require('../middleware/validate');
const { contactLimiter, reviewLimiter, analyticsLimiter } = require('../middleware/rateLimiters');
const { createContactMessageSchema } = require('../validators/contactValidators');
const { createPublicReviewSchema } = require('../validators/testimonialValidators');
const { trackEventSchema } = require('../validators/trackValidators');

const router = express.Router();

router.get('/products', contentController.getProducts);
router.get('/categories', contentController.getCategories);
router.get('/gallery', contentController.getGallery);
router.get('/offers', contentController.getOffers);
router.get('/settings', contentController.getSettings);
router.get('/about', contentController.getAbout);
router.get('/testimonials', contentController.getTestimonials);
router.get('/hero-banners', contentController.getHeroBanners);

router.post('/contact', contactLimiter, validate(createContactMessageSchema), contactController.create);
router.post('/reviews', reviewLimiter, validate(createPublicReviewSchema), reviewsController.create);
router.post('/analytics/track', analyticsLimiter, validate(trackEventSchema), analyticsController.trackEvent);

module.exports = router;
