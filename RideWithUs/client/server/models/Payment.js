const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: { type: Number, required: true },   // in paise  (₹100 = 10000)
    currency: { type: String, default: 'inr' },

    // ── Razorpay IDs ───────────────────────────────────────────────
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    razorpayRefundId: { type: String, default: '' },

    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
    },

    paidAt: { type: Date },
    refundedAt: { type: Date },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

paymentSchema.index({ booking: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
