const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, updateVehicle, getStats, getUserById,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/vehicle', protect, updateVehicle);
router.get('/stats', protect, getStats);
router.get('/:id', protect, getUserById);

module.exports = router;
