const axios = require('axios');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

const geocodeAddress = async (address) => {
  if (!MAPS_KEY) throw new Error('GOOGLE_MAPS_API_KEY missing');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}&region=in`;
  const { data } = await axios.get(url);
  if (data.status === 'OK') {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng, formattedAddress: data.results[0].formatted_address };
  }
  throw new Error(`Geocoding failed: ${data.status}`);
};

const getRouteInfo = async (oLat, oLng, dLat, dLng) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&key=${MAPS_KEY}`;
    const { data } = await axios.get(url);
    if (data.status === 'OK') {
      const leg = data.routes[0].legs[0];
      return {
        distanceKm: (leg.distance.value / 1000).toFixed(1),
        durationMins: Math.ceil(leg.duration.value / 60),
        polyline: data.routes[0].overview_polyline.points,
      };
    }
  } catch { }
  return { distanceKm: 0, durationMins: 0, polyline: '' };
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371, dL = ((lat2 - lat1) * Math.PI) / 180, dG = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};


exports.createRide = async (req, res) => {
  try {
    const { vehicleType, originAddress, destinationAddress, departureTime, totalSeats, pricePerSeat, notes } = req.body;
    if (!vehicleType || !originAddress || !destinationAddress || !departureTime || !totalSeats || !pricePerSeat)
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    if (new Date(departureTime) < new Date())
      return res.status(400).json({ success: false, message: 'Departure time must be in the future' });

    let originGeo, destGeo, routeInfo;
    try {
      [originGeo, destGeo] = await Promise.all([geocodeAddress(originAddress), geocodeAddress(destinationAddress)]);
      routeInfo = await getRouteInfo(originGeo.lat, originGeo.lng, destGeo.lat, destGeo.lng);
    } catch {
      originGeo = { lat: 0, lng: 0, formattedAddress: originAddress };
      destGeo = { lat: 0, lng: 0, formattedAddress: destinationAddress };
      routeInfo = { distanceKm: 0, durationMins: 0, polyline: '' };
    }

    const ride = await Ride.create({
      driver: req.user._id, vehicleType, vehicleInfo: req.user.vehicle || {},
      origin: { type: 'Point', coordinates: [originGeo.lng, originGeo.lat], address: originGeo.formattedAddress },
      destination: { type: 'Point', coordinates: [destGeo.lng, destGeo.lat], address: destGeo.formattedAddress },
      routePolyline: routeInfo.polyline,
      departureTime: new Date(departureTime),
      totalSeats: Number(totalSeats), availableSeats: Number(totalSeats),
      pricePerSeat: Number(pricePerSeat), notes: notes || '',
      distanceKm: routeInfo.distanceKm, durationMins: routeInfo.durationMins,
    });
    await ride.populate('driver', 'name phone rating vehicle profilePhoto');
    res.status(201).json({ success: true, message: 'Ride created', ride });
  } catch (err) {
    console.error('createRide:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllRides = async (req, res) => {
  try {
    const { vehicleType, page = 1, limit = 10 } = req.query;
    const filter = {
      status: { $in: ['scheduled', 'active'] },
      departureTime: { $gte: new Date() },          // ← no outdated rides
      driver: { $ne: req.user._id },          // ← hide own rides
    };
    if (vehicleType) filter.vehicleType = vehicleType;

    const rides = await Ride.find(filter)
      .populate('driver', 'name phone rating profilePhoto vehicle')
      .sort({ departureTime: 1 })
      .skip((page - 1) * limit).limit(Number(limit));
    const total = await Ride.countDocuments(filter);
    res.json({ success: true, count: rides.length, total, rides });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyRides = async (req, res) => {
  try {
    const rides = await Ride.find({ driver: req.user._id })
      .sort({ departureTime: -1 });
    res.json({ success: true, rides });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.searchRides = async (req, res) => {
  try {
    const { originAddress, destinationAddress, date, seats = 1 } = req.query;
    if (!originAddress || !destinationAddress || !date)
      return res.status(400).json({ success: false, message: 'Origin, destination and date required' });

    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
    const now = new Date();

    const baseQuery = {
      availableSeats: { $gte: Number(seats) },
      status: { $in: ['scheduled', 'active'] },
      departureTime: { $gte: now > startOfDay ? now : startOfDay, $lte: endOfDay },
      driver: { $ne: req.user._id },         // ← own rides hidden
    };

    let rides = [], searchOrigin = null, searchDest = null;
    try {
      [searchOrigin, searchDest] = await Promise.all([
        geocodeAddress(originAddress), geocodeAddress(destinationAddress)
      ]);
      try {
        rides = await Ride.find({
          ...baseQuery,
          'origin.coordinates': {
            $near: { $geometry: { type: 'Point', coordinates: [searchOrigin.lng, searchOrigin.lat] }, $maxDistance: 50000 }
          },
        }).populate('driver', 'name phone rating vehicle profilePhoto').limit(30);
        rides = rides.filter(r => {
          if (!r.destination?.coordinates?.length) return true;
          return haversineKm(searchDest.lat, searchDest.lng, r.destination.coordinates[1], r.destination.coordinates[0]) <= 100;
        });
      } catch {
        rides = await Ride.find(baseQuery).populate('driver', 'name phone rating vehicle profilePhoto').sort({ departureTime: 1 }).limit(30);
      }
    } catch {
      const oTerm = originAddress.split(',')[0].trim();
      const dTerm = destinationAddress.split(',')[0].trim();
      rides = await Ride.find({
        ...baseQuery,
        $or: [{ 'origin.address': { $regex: oTerm, $options: 'i' } }, { 'destination.address': { $regex: dTerm, $options: 'i' } }]
      }).populate('driver', 'name phone rating vehicle profilePhoto').sort({ departureTime: 1 }).limit(30);
    }

    const enriched = rides.map(r => {
      const obj = r.toObject();
      if (searchOrigin && r.origin?.coordinates?.length) {
        obj.distanceToPickupKm = haversineKm(searchOrigin.lat, searchOrigin.lng, r.origin.coordinates[1], r.origin.coordinates[0]).toFixed(1);
      }
      return obj;
    });
    res.json({ success: true, count: enriched.length, rides: enriched });
  } catch (err) {
    console.error('searchRides:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRideById = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).populate('driver', 'name phone rating vehicle profilePhoto');
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    const bookings = await Booking.find({ ride: ride._id }).populate('passenger', 'name phone rating profilePhoto');
    res.json({ success: true, ride, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorised' });

    const allowed = ['departureTime', 'pricePerSeat', 'notes', 'availableSeats', 'status'];
    allowed.forEach(f => { if (req.body[f] !== undefined) ride[f] = req.body[f]; });

    if (req.body.originAddress) {
      try {
        const g = await geocodeAddress(req.body.originAddress);
        ride.origin = { type: 'Point', coordinates: [g.lng, g.lat], address: g.formattedAddress };
      } catch { }
    }
    if (req.body.destinationAddress) {
      try {
        const g = await geocodeAddress(req.body.destinationAddress);
        ride.destination = { type: 'Point', coordinates: [g.lng, g.lat], address: g.formattedAddress };
      } catch { }
    }
    await ride.save();
    res.json({ success: true, message: 'Ride updated', ride });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.driver.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });

    // Accept optional reason from request body (driver cancel with reason)
    const reason = req.body?.reason?.trim() || 'Driver cancelled the ride';

    ride.status = 'cancelled';
    ride.notes = ride.notes ? `${ride.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`;
    await ride.save();

    await Booking.updateMany(
      { ride: ride._id, status: { $in: ['pending', 'confirmed'] } },
      { status: 'cancelled', cancelledBy: 'driver', cancellationNote: reason }
    );

    if (req.io) req.io.to(`ride_${ride._id}`).emit('ride:cancelled', { rideId: ride._id, reason });
    res.json({ success: true, message: 'Ride cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.driver.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorised' });
    ride.currentLocation = { type: 'Point', coordinates: [Number(lng), Number(lat)], updatedAt: new Date() };
    await ride.save();
    if (req.io) req.io.to(`ride_${ride._id}`).emit('driver:location', { lat, lng, rideId: ride._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRideStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.driver.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorised' });
    ride.status = status;
    await ride.save();
    if (status === 'completed') {
      await Booking.updateMany({ ride: ride._id, status: { $in: ['confirmed', 'started'] } }, { status: 'completed' });
    }
    if (req.io) req.io.to(`ride_${ride._id}`).emit('ride:statusUpdate', { rideId: ride._id, status });
    res.json({ success: true, ride });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
