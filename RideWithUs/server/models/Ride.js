
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vehicleType: { type: String, enum: ['bike', 'car'], required: true },
    vehicleInfo: {
      model: { type: String, default: '' },
      registration: { type: String, default: '' },
      color: { type: String, default: '' },
    },
    origin: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: { type: String, required: true },
    },
    destination: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: { type: String, required: true },
    },
    routePolyline: { type: String, default: '' },
    departureTime: { type: Date, required: true },
    totalSeats: { type: Number, required: true, min: 1, max: 4 },
    availableSeats: { type: Number, required: true, min: 0 },
    pricePerSeat: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'started', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    notes: { type: String, default: '', maxlength: 300 },
    distanceKm: { type: Number, default: 0 },
    durationMins: { type: Number, default: 0 },
    currentLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

rideSchema.index({ 'origin.coordinates': '2dsphere' });
rideSchema.index({ 'destination.coordinates': '2dsphere' });
rideSchema.index({ departureTime: 1, status: 1 });
rideSchema.index({ driver: 1 });

module.exports = mongoose.model('Ride', rideSchema);
