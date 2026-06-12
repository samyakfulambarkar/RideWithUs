
const Booking = require('../models/Booking');
const Ride    = require('../models/Ride');
const User    = require('../models/User');

// ── POST /api/bookings ────────────────────────────────────────────
exports.createBooking = async (req, res) => {
  try {
    const { rideId, seatsBooked = 1, pickupAddress, dropAddress } = req.body;
    if (!rideId) return res.status(400).json({ success: false, message: 'rideId required' });

    const ride = await Ride.findById(rideId).populate('driver');
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['scheduled', 'active'].includes(ride.status))
      return res.status(400).json({ success: false, message: `Ride is ${ride.status}` });
    if (ride.driver._id.toString() === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Cannot book your own ride' });

    const seats = Number(seatsBooked);

    if (ride.availableSeats < seats)
      return res.status(400).json({ success: false, message: `Only ${ride.availableSeats} seat(s) left` });

    // ── Check for ACTIVE (non-cancelled) existing booking ─────────
    const existing = await Booking.findOne({
      ride: rideId,
      passenger: req.user._id,
      status: { $nin: ['cancelled', 'denied'] },
    });

    if (existing) {
      // Passenger already has an active booking — add more seats to it
      const newTotal = existing.seatsBooked + seats;
      if (newTotal > 4)
        return res.status(400).json({ success: false, message: `Cannot book more than 4 seats total. You already have ${existing.seatsBooked}.` });
      if (ride.availableSeats < seats)
        return res.status(400).json({ success: false, message: `Only ${ride.availableSeats} seat(s) available` });

      existing.seatsBooked = newTotal;
      existing.totalAmount = ride.pricePerSeat * newTotal;
      existing.status      = 'pending';  // reset for driver re-confirmation
      await existing.save();

      ride.availableSeats = Math.max(0, ride.availableSeats - seats);
      await ride.save();

      await existing.populate([
        { path: 'ride',      select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status' },
        { path: 'passenger', select: 'name phone rating profilePhoto' },
        { path: 'driver',    select: 'name phone vehicle rating profilePhoto' },
      ]);

      if (req.io) {
        req.io.to(`user_${ride.driver._id}`).emit('booking:new', {
          bookingId: existing._id, rideId: ride._id,
          passenger: { name: req.user.name, phone: req.user.phone },
          seatsBooked: newTotal, totalAmount: existing.totalAmount,
          origin: ride.origin.address, destination: ride.destination.address,
          note: `Updated — now ${newTotal} seat(s)`,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Booking updated to ${newTotal} seat(s). Waiting for driver re-confirmation.`,
        booking: existing,
      });
    }

    // ── Check for a CANCELLED booking on the same ride ───────────
    // Re-activate it to avoid creating a duplicate document
    // Also allow re-booking after a denial (status = 'denied')
    const cancelled = await Booking.findOne({
      ride: rideId,
      passenger: req.user._id,
      status: { $in: ['cancelled', 'denied'] },
    }).sort({ updatedAt: -1 });

    let booking;

    if (cancelled) {
      // Re-use the cancelled booking — reset all fields cleanly
      cancelled.seatsBooked        = seats;
      cancelled.totalAmount        = ride.pricePerSeat * seats;
      cancelled.status             = 'pending';
      cancelled.cancelledBy        = '';
      cancelled.cancellationNote   = '';
      cancelled.payment            = { status: 'pending', razorpayOrderId: '', razorpayPaymentId: '' };
      cancelled.rating             = undefined;
      cancelled.pickupLocation     = { address: pickupAddress || ride.origin.address };
      cancelled.dropLocation       = { address: dropAddress   || ride.destination.address };
      await cancelled.save();
      booking = cancelled;
    } else {
      // Brand new booking
      booking = await Booking.create({
        ride: rideId, passenger: req.user._id, driver: ride.driver._id,
        seatsBooked: seats,
        totalAmount: ride.pricePerSeat * seats,
        status: 'pending',
        pickupLocation: { address: pickupAddress || ride.origin.address },
        dropLocation:   { address: dropAddress   || ride.destination.address },
      });
    }

    // Reserve seats on the ride
    ride.availableSeats = Math.max(0, ride.availableSeats - seats);
    await ride.save();

    await booking.populate([
      { path: 'ride',      select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status' },
      { path: 'passenger', select: 'name phone rating profilePhoto' },
      { path: 'driver',    select: 'name phone vehicle rating profilePhoto' },
    ]);

    if (req.io) {
      req.io.to(`user_${ride.driver._id}`).emit('booking:new', {
        bookingId: booking._id, rideId: ride._id,
        passenger: { name: req.user.name, phone: req.user.phone },
        seatsBooked: seats, totalAmount: booking.totalAmount,
        origin: ride.origin.address, destination: ride.destination.address,
      });
    }

    res.status(201).json({ success: true, message: 'Ride booked! Waiting for driver confirmation.', booking });
  } catch (err) {
    console.error('createBooking:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/bookings/my ──────────────────────────────────────────
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ passenger: req.user._id })
      .populate({
        path: 'ride',
        select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status _id',
        populate: { path: 'driver', select: 'name phone rating vehicle profilePhoto' },
      })
      .populate('driver',    'name phone rating vehicle profilePhoto')
      .populate('passenger', 'name phone rating profilePhoto')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/bookings/driver ──────────────────────────────────────
exports.getDriverBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ driver: req.user._id })
      .populate({ path: 'ride', select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status _id' })
      .populate('passenger', 'name phone rating profilePhoto')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/bookings/:id ─────────────────────────────────────────
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({ path: 'ride', select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status _id' })
      .populate('passenger', 'name phone rating profilePhoto')
      .populate('driver',    'name phone vehicle rating profilePhoto');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const ids = [booking.passenger?._id?.toString(), booking.driver?._id?.toString()];
    if (!ids.includes(req.user._id.toString()) && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/bookings/:id/accept ──────────────────────────────────
exports.acceptBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only driver can accept' });
    if (booking.status !== 'pending')
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}` });

    booking.status = 'confirmed';
    await booking.save();

    if (req.io) {
      req.io.to(`user_${booking.passenger}`).emit('booking:accepted', {
        bookingId: booking._id, message: `${req.user.name} accepted your ride request!`,
      });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', { status: 'confirmed', bookingId: booking._id });
    }
    res.json({ success: true, message: 'Booking accepted', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/bookings/:id/deny ────────────────────────────────────
exports.denyBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only driver can deny' });
    if (booking.status !== 'pending')
      return res.status(400).json({ success: false, message: `Booking is ${booking.status}` });

    booking.status           = 'denied';
    booking.cancelledBy      = 'driver';
    booking.cancellationNote = reason || 'Driver declined your request';
    await booking.save();

    // Restore the seats so other passengers can book them
    await Ride.findByIdAndUpdate(booking.ride, { $inc: { availableSeats: booking.seatsBooked } });

    if (req.io) {
      req.io.to(`user_${booking.passenger}`).emit('booking:denied', {
        bookingId: booking._id,
        reason: booking.cancellationNote,
      });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', {
        status: 'denied', bookingId: booking._id,
      });
    }
    res.json({ success: true, message: 'Booking request denied', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/bookings/:id/confirm — alias for accept ─────────────
exports.confirmBooking = exports.acceptBooking;

// ── PUT /api/bookings/:id/cancel ─────────────────────────────────
exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const isPassenger = booking.passenger.toString() === req.user._id.toString();
    const isDriver    = booking.driver.toString()    === req.user._id.toString();
    if (!isPassenger && !isDriver && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    if (['completed', 'cancelled'].includes(booking.status))
      return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.status} booking` });

    booking.status           = 'cancelled';
    booking.cancelledBy      = req.user.role === 'admin' ? 'admin' : isDriver ? 'driver' : 'passenger';
    booking.cancellationNote = reason || '';
    await booking.save();

    await Ride.findByIdAndUpdate(booking.ride, { $inc: { availableSeats: booking.seatsBooked } });

    const notifyId = isPassenger ? booking.driver : booking.passenger;
    if (req.io) {
      req.io.to(`user_${notifyId}`).emit('booking:cancelled', { bookingId: booking._id, cancelledBy: booking.cancelledBy });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', { status: 'cancelled', bookingId: booking._id });
    }
    res.json({ success: true, message: 'Booking cancelled', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/bookings/:id/payment-done ───────────────────────────
exports.markPaymentDone = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only driver can mark payment done' });
    if (booking.status !== 'confirmed')
      return res.status(400).json({ success: false, message: 'Booking must be confirmed first' });

    booking.status         = 'completed';
    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date();
    await booking.save();

    if (req.io) {
      req.io.to(`user_${booking.passenger}`).emit('booking:paymentDone', {
        bookingId: booking._id, message: 'Payment confirmed! Your ride is complete. 🎉',
      });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', {
        status: 'completed', paymentStatus: 'paid', bookingId: booking._id,
      });
    }
    res.json({ success: true, message: 'Payment marked done. Ride completed!', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/bookings/:id/rate ───────────────────────────────────
exports.rateBooking = async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5)
      return res.status(400).json({ success: false, message: 'Score 1-5 required' });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.passenger.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only passenger can rate' });
    if (booking.status !== 'completed')
      return res.status(400).json({ success: false, message: 'Can only rate completed rides' });
    if (booking.rating?.score)
      return res.status(400).json({ success: false, message: 'Already rated' });

    booking.rating = { score: Number(score), comment: comment || '', ratedAt: new Date() };
    await booking.save();

    const driver = await User.findById(booking.driver);
    const prev   = driver.rating || { average: 0, count: 0 };
    const newCnt = prev.count + 1;
    driver.rating = {
      average: Math.round(((prev.average * prev.count) + Number(score)) / newCnt * 10) / 10,
      count: newCnt,
    };
    await driver.save();
    res.json({ success: true, message: 'Rating submitted!', rating: booking.rating });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
