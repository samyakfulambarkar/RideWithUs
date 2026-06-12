/**
 * paymentController.js — Razorpay integration
 *
 * Flow:
 *   1. POST /payments/create-order  → validate keys, create Razorpay order
 *   2. Client opens Razorpay checkout modal
 *   3. POST /payments/verify        → HMAC verification, mark booking paid
 *   4. GET  /payments/booking/:id   → fetch payment record
 *   5. POST /payments/refund/:id    → admin-only refund
 */

const crypto  = require('crypto');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

// ── Validate keys at startup-ish time without crashing ───────────
const validateRazorpayKeys = () => {
  const keyId     = (process.env.RAZORPAY_KEY_ID     || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret) {
    return { valid: false, message: 'Razorpay keys missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env' };
  }
  if (keyId.includes('REPLACE') || keySecret.includes('REPLACE')) {
    return { valid: false, message: 'Razorpay keys not set. Replace the placeholder values in server/.env' };
  }
  if (!keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
    return { valid: false, message: `Invalid RAZORPAY_KEY_ID format. Must start with rzp_test_ or rzp_live_. Got: ${keyId.substring(0, 12)}...` };
  }
  return { valid: true, keyId, keySecret };
};

// ── Lazily initialise Razorpay instance ──────────────────────────
let _razorpay = null;
const getRazorpay = () => {
  const check = validateRazorpayKeys();
  if (!check.valid) throw new Error(check.message);

  if (!_razorpay) {
    try {
      const Razorpay = require('razorpay');
      _razorpay = new Razorpay({
        key_id:     check.keyId,
        key_secret: check.keySecret,
      });
    } catch (err) {
      _razorpay = null;
      throw new Error(`Failed to initialise Razorpay SDK: ${err.message}`);
    }
  }
  return _razorpay;
};

// ── POST /api/payments/create-order ───────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    // Validate keys first — return clear error instead of crashing
    const keyCheck = validateRazorpayKeys();
    if (!keyCheck.valid) {
      return res.status(503).json({ success: false, message: keyCheck.message });
    }

    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('ride', 'origin destination departureTime vehicleType')
      .populate('driver', 'name');

    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.passenger.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorised' });

    if (booking.payment.status === 'paid')
      return res.status(400).json({ success: false, message: 'Booking already paid' });

    if (!['pending', 'confirmed'].includes(booking.status))
      return res.status(400).json({ success: false, message: `Cannot pay for a ${booking.status} booking` });

    const amountPaise = Math.round(booking.totalAmount * 100); // ₹ → paise, must be integer

    if (amountPaise < 100) {
      return res.status(400).json({ success: false, message: 'Amount too small (minimum ₹1)' });
    }

    let razorpay;
    try {
      razorpay = getRazorpay();
    } catch (sdkErr) {
      return res.status(503).json({ success: false, message: sdkErr.message });
    }

    // receipt must be <= 40 chars
    const receipt = `rwu_${bookingId}`.substring(0, 40);

    let order;
    try {
      order = await razorpay.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          bookingId: bookingId.toString(),
          userId:    req.user._id.toString(),
        },
      });
    } catch (orderErr) {
      console.error('Razorpay order creation failed:', orderErr);
      // Parse Razorpay error
      const msg = orderErr.error?.description
        || orderErr.message
        || 'Failed to create payment order. Check your Razorpay keys.';
      return res.status(502).json({ success: false, message: msg });
    }

    // Persist order id in booking
    booking.payment.razorpayOrderId = order.id;
    await booking.save();

    // Upsert Payment record
    await Payment.findOneAndUpdate(
      { booking: bookingId },
      {
        booking:         bookingId,
        user:            req.user._id,
        amount:          amountPaise,
        razorpayOrderId: order.id,
        status:          'created',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success:  true,
      orderId:  order.id,
      amount:   amountPaise,
      currency: 'INR',
      keyId:    keyCheck.keyId,
    });
  } catch (error) {
    console.error('createOrder unexpected error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/payments/verify ─────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const {
      bookingId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }

    // HMAC-SHA256 signature verification
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keySecret) {
      return res.status(503).json({ success: false, message: 'Razorpay not configured on server' });
    }

    const body     = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

    if (expected !== razorpaySignature) {
      console.warn('Signature mismatch — possible tampered payment');
      return res.status(400).json({ success: false, message: 'Payment verification failed — signature mismatch' });
    }

    // Mark booking as paid + confirmed
    const booking = await Booking.findById(bookingId);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.payment.status            = 'paid';
    booking.payment.razorpayPaymentId = razorpayPaymentId;
    booking.payment.paidAt            = new Date();
    booking.status                    = 'confirmed';
    await booking.save();

    // Update Payment record
    await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: 'paid',
        paidAt: new Date(),
      }
    );

    // Real-time notify driver
    if (req.io) {
      req.io.to(`user_${booking.driver}`).emit('booking:paid', {
        bookingId: booking._id,
        message:   'Passenger paid for the ride! 💳',
      });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', {
        status: 'confirmed', paymentStatus: 'paid', bookingId: booking._id,
      });
    }

    res.json({ success: true, message: 'Payment verified successfully', booking });
  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/payments/booking/:bookingId ──────────────────────────
exports.getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment)
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/payments/refund/:bookingId (admin only) ─────────────
exports.refundPayment = async (req, res) => {
  try {
    const keyCheck = validateRazorpayKeys();
    if (!keyCheck.valid) {
      return res.status(503).json({ success: false, message: keyCheck.message });
    }

    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment)
      return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status !== 'paid')
      return res.status(400).json({ success: false, message: 'No paid payment to refund' });

    let razorpay;
    try {
      razorpay = getRazorpay();
    } catch (sdkErr) {
      return res.status(503).json({ success: false, message: sdkErr.message });
    }

    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: payment.amount,
      notes:  { reason: req.body.reason || 'Admin refund' },
    });

    payment.status           = 'refunded';
    payment.razorpayRefundId = refund.id;
    payment.refundedAt       = new Date();
    await payment.save();

    await Booking.findByIdAndUpdate(req.params.bookingId, {
      status:          'refunded',
      'payment.status': 'refunded',
    });

    res.json({ success: true, message: 'Refund initiated', refundId: refund.id });
  } catch (error) {
    console.error('refundPayment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
