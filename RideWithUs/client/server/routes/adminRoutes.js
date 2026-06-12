const express = require('express');
const router = express.Router();
const {
  getDashboard, getAllUsers, deactivateUser, activateUser, makeAdmin,
  getAllRidesAdmin, deleteRideAdmin, getAllBookingsAdmin, getRevenue,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

router.get('/dashboard', getDashboard);
router.get('/revenue', getRevenue);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/deactivate', deactivateUser);
router.put('/users/:id/activate', activateUser);
router.put('/users/:id/make-admin', makeAdmin);

// Ride management
router.get('/rides', getAllRidesAdmin);
router.delete('/rides/:id', deleteRideAdmin);

// Booking management
router.get('/bookings', getAllBookingsAdmin);

module.exports = router;
