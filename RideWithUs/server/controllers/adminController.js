const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Message = require('../models/Message');

// ── @route  GET /api/admin/dashboard ─────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalRides,
      totalBookings,
      activeRides,
      newUsersThisMonth,
      newRidesThisMonth,
      revenueData,
      vehicleBreakdown,
      statusBreakdown,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Ride.countDocuments(),
      Booking.countDocuments(),
      Ride.countDocuments({ status: { $in: ['scheduled', 'active', 'started'] } }),
      User.countDocuments({ createdAt: { $gte: startMonth } }),
      Ride.countDocuments({ createdAt: { $gte: startMonth } }),
      Booking.aggregate([
        { $match: { 'payment.status': 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Ride.aggregate([
        { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const totalRevenue = revenueData[0]?.total || 0;

    res.json({
      success: true,
      dashboard: {
        totalUsers,
        totalRides,
        totalBookings,
        activeRides,
        newUsersThisMonth,
        newRidesThisMonth,
        totalRevenue,
        vehicleBreakdown: vehicleBreakdown.reduce((acc, v) => {
          acc[v._id] = v.count; return acc;
        }, {}),
        bookingStatusBreakdown: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count; return acc;
        }, {}),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/admin/users ─────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.json({ success: true, total, page: Number(page), users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  PUT /api/admin/users/:id/deactivate ──────────────────
exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deactivated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  PUT /api/admin/users/:id/activate ────────────────────
exports.activateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User activated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  PUT /api/admin/users/:id/make-admin ──────────────────
exports.makeAdmin = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: 'admin' },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: `${user.name} is now an admin`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/admin/rides ─────────────────────────────────
exports.getAllRidesAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, vehicleType, status } = req.query;
    const filter = {};
    if (vehicleType) filter.vehicleType = vehicleType;
    // FIX: when no status filter is chosen, default to non-cancelled rides.
    // Admin-deleted rides are marked 'cancelled' — without this they reappear
    // on every page refresh. Explicitly passing status=cancelled still works.
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'cancelled' };
    }

    const rides = await Ride.find(filter)
      .populate('driver', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Ride.countDocuments(filter);

    res.json({ success: true, total, page: Number(page), rides });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  DELETE /api/admin/rides/:id ──────────────────────────
exports.deleteRideAdmin = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    // Cancel related bookings
    await Booking.updateMany(
      { ride: ride._id, status: { $in: ['pending', 'confirmed'] } },
      { status: 'cancelled', cancelledBy: 'admin', cancellationNote: 'Ride removed by admin' }
    );

    ride.status = 'cancelled';
    await ride.save();

    // Notify Socket.IO
    if (req.io) {
      req.io.to(`ride_${ride._id}`).emit('ride:cancelled', { rideId: ride._id, reason: 'Admin removed this ride' });
    }

    res.json({ success: true, message: 'Ride deleted by admin' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/admin/bookings ──────────────────────────────
exports.getAllBookingsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate('ride', 'origin destination departureTime vehicleType')
      .populate('passenger', 'name phone')
      .populate('driver', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Booking.countDocuments(filter);

    res.json({ success: true, total, page: Number(page), bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── @route  GET /api/admin/revenue ───────────────────────────────
exports.getRevenue = async (req, res) => {
  try {
    // Monthly revenue for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthly = await Booking.aggregate([
      { $match: { 'payment.status': 'paid', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({ success: true, monthly });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
