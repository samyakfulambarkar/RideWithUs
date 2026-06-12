

const express = require('express');
const router = express.Router();
const {
  createRide, searchRides, getAllRides, getMyRides,
  getRideById, updateRide, deleteRide,
  updateLocation, updateRideStatus,
} = require('../controllers/rideController');
const { protect } = require('../middleware/auth');

router.get('/search', protect, searchRides);
router.get('/my', protect, getMyRides);
router.get('/', protect, getAllRides);
router.post('/', protect, createRide);
router.get('/:id', protect, getRideById);
router.put('/:id', protect, updateRide);
router.delete('/:id', protect, deleteRide);
router.put('/:id/location', protect, updateLocation);
router.put('/:id/status', protect, updateRideStatus);

module.exports = router;
