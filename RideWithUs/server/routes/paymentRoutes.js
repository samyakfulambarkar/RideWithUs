const express = require('express');
const router  = express.Router();
const {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  refundPayment,
} = require('../controllers/paymentController');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/payments/create-order  — passenger creates a Razorpay order
router.post('/create-order', protect, createOrder);

// POST /api/payments/verify        — passenger verifies HMAC after checkout
router.post('/verify', protect, verifyPayment);

// GET  /api/payments/booking/:bookingId — fetch payment record
router.get('/booking/:bookingId', protect, getPaymentStatus);

// POST /api/payments/refund/:bookingId  — admin-only refund
router.post('/refund/:bookingId', protect, adminOnly, refundPayment);

module.exports = router;
