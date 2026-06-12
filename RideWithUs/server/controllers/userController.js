const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-__v');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.updateProfile = async (req, res) => {
  try {
    const { name, profilePhoto } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (profilePhoto) updates.profilePhoto = profilePhoto;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true,
    }).select('-__v');

    res.json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const { type, model, registration, color } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { vehicle: { type, model, registration, color } },
      { new: true, runValidators: true }
    ).select('-__v');

    res.json({ success: true, message: 'Vehicle info updated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [totalRidesOffered, totalRidesBooked, totalEarned] = await Promise.all([
      Ride.countDocuments({ driver: req.user._id }),
      Booking.countDocuments({ passenger: req.user._id }),
      Booking.aggregate([
        { $match: { driver: req.user._id, 'payment.status': 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        totalRidesOffered,
        totalRidesBooked,
        totalEarned: totalEarned[0]?.total || 0,
        rating: req.user.rating,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name profilePhoto rating vehicle totalRides createdAt');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
