require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Ride = require('../models/Ride');

const connectDB = require('../config/db');

const sampleUsers = [
  { name: 'Pranav Durge', phone: '+917083642916', role: 'user', isVerified: true, rating: { average: 4.8, count: 24 }, vehicle: { type: 'car', model: 'Swift Dzire', registration: 'MH12AB1234', color: 'White' } },
  { name: 'Priya Sharma', phone: '+919876543210', role: 'user', isVerified: true, rating: { average: 4.9, count: 31 }, vehicle: { type: 'bike', model: 'Honda Activa', registration: 'MH14CD5678', color: 'Blue' } },
  { name: 'Arjun Mehta', phone: '+919123456789', role: 'user', isVerified: true, rating: { average: 4.6, count: 18 }, vehicle: { type: 'car', model: 'Ertiga', registration: 'MH01EF9012', color: 'Silver' } },
  { name: 'Admin User', phone: '+911234567890', role: 'admin', isVerified: true, rating: { average: 0, count: 0 } },
];


const sampleRides = [
  {
    vehicleType: 'car',
    origin: { type: 'Point', coordinates: [73.7398, 18.5913], address: 'Hinjewadi Phase 1, Pune' },
    destination: { type: 'Point', coordinates: [72.8777, 19.0760], address: 'Bandra West, Mumbai' },
    departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    totalSeats: 3,
    availableSeats: 3,
    pricePerSeat: 250,
    distanceKm: 148,
    durationMins: 185,
    status: 'scheduled',
  },
  {
    vehicleType: 'bike',
    origin: { type: 'Point', coordinates: [73.8567, 18.5204], address: 'FC Road, Pune' },
    destination: { type: 'Point', coordinates: [73.8478, 18.4977], address: 'Swargate, Pune' },
    departureTime: new Date(Date.now() + 1 * 60 * 60 * 1000),
    totalSeats: 1,
    availableSeats: 1,
    pricePerSeat: 40,
    distanceKm: 5.2,
    durationMins: 18,
    status: 'scheduled',
  },
  {
    vehicleType: 'car',
    origin: { type: 'Point', coordinates: [73.8067, 18.5908], address: 'Wakad, Pune' },
    destination: { type: 'Point', coordinates: [73.0297, 18.6298], address: 'Kharghar, Navi Mumbai' },
    departureTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
    totalSeats: 4,
    availableSeats: 4,
    pricePerSeat: 200,
    distanceKm: 130,
    durationMins: 160,
    status: 'scheduled',
  },
];

const seed = async () => {
  await connectDB();

  console.log('🌱 Clearing existing data...');
  await User.deleteMany({});
  await Ride.deleteMany({});

  console.log('👥 Creating users...');
  const users = await User.insertMany(sampleUsers);

  console.log('🚗 Creating rides...');
  const ridesWithDrivers = sampleRides.map((ride, i) => ({
    ...ride,
    driver: users[i % 3]._id,
    vehicleInfo: users[i % 3].vehicle,
  }));
  await Ride.insertMany(ridesWithDrivers);

  console.log(`\n✅ Seed complete!`);
  console.log(`   ${users.length} users created`);
  console.log(`   ${ridesWithDrivers.length} rides created`);
  console.log(`\n📱 Admin login phone: +911234567890`);
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
