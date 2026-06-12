const express = require('express');
const router  = express.Router();
const {
  createBooking, getMyBookings, getDriverBookings, getBookingById,
  acceptBooking, denyBooking, confirmBooking, cancelBooking,
  markPaymentDone, rateBooking,
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');

router.post('/',                    protect, createBooking);
router.get('/my',                   protect, getMyBookings);
router.get('/driver',               protect, getDriverBookings);
router.get('/:id',                  protect, getBookingById);
router.put('/:id/accept',           protect, acceptBooking);
router.put('/:id/deny',             protect, denyBooking);
router.put('/:id/confirm',          protect, confirmBooking);   // alias for accept
router.put('/:id/cancel',           protect, cancelBooking);
router.put('/:id/payment-done',     protect, markPaymentDone);
router.post('/:id/rate',            protect, rateBooking);

module.exports = router;
