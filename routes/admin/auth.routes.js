const express = require('express');
const authController = require('../../controllers/admin/authController');
const { requireAdminAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { loginLimiter, otpLimiter } = require('../../middleware/rateLimiters');
const { loginSchema, verifyOtpSchema } = require('../../validators/authValidators');

const router = express.Router();

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/verify', otpLimiter, validate(verifyOtpSchema), authController.verify);
router.post('/resend-otp', otpLimiter, authController.resendOtp);
router.post('/refresh', authController.refresh);
router.get('/me', requireAdminAuth, authController.me);
router.post('/logout', requireAdminAuth, authController.logout);

module.exports = router;
