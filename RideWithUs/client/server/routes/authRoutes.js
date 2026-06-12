const express = require('express');
const router = express.Router();
const { sendOTPHandler, verifyOTPHandler, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please wait an hour.' },
});

router.post('/send-otp', otpLimiter, sendOTPHandler);
router.post('/verify-otp', verifyOTPHandler);
router.get('/me', protect, getMe);

module.exports = router;
