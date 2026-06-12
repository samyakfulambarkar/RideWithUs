const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // ── Drop the old unique index on Booking {ride, passenger} ───
    // The original schema had { unique: true } which blocks re-booking
    // after cancellation. We now enforce uniqueness at the application
    // level instead. This migration runs safely even if the index
    // doesn't exist (the catch ignores that case).
    try {
      const db = conn.connection.db;
      await db.collection('bookings').dropIndex('ride_1_passenger_1');
      console.log('✅ Dropped old unique Booking index (ride+passenger)');
    } catch (idxErr) {
      // Index didn't exist or already dropped — safe to ignore
      if (!idxErr.message.includes('index not found') &&
          !idxErr.message.includes('ns not found')) {
        console.warn('⚠️  Could not drop Booking index:', idxErr.message);
      }
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
