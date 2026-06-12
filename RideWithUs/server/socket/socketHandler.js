const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('name phone role');
    if (!user) return next(new Error('User not found'));
    socket.user = user;
    next();
  } catch { next(new Error('Invalid token')); }
};

const initSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`🔌 ${socket.user.name} connected (${socket.id})`);

    socket.join(`user_${socket.user._id}`);

    socket.on('ride:join', ({ rideId }) => { socket.join(`ride_${rideId}`); });
    socket.on('ride:leave', ({ rideId }) => { socket.leave(`ride_${rideId}`); });

    socket.on('driver:updateLocation', ({ rideId, lat, lng }) => {
      if (!rideId || lat === undefined || lng === undefined) return;
      io.to(`ride_${rideId}`).emit('driver:location', {
        rideId, lat, lng, driverId: socket.user._id, timestamp: new Date(),
      });
    });

    socket.on('ride:updateStatus', ({ rideId, status }) => {
      io.to(`ride_${rideId}`).emit('ride:statusUpdate', { rideId, status, updatedBy: socket.user.name });
    });

    socket.on('booking:join', ({ bookingId }) => {
      socket.join(`booking_${bookingId}`);
      socket.emit('booking:joined', { bookingId });
    });

    socket.on('booking:leave', ({ bookingId }) => {
      socket.leave(`booking_${bookingId}`);
    });

    socket.on('message:send', ({ bookingId, text, receiverId }) => {
      if (!bookingId || !text?.trim()) return;
      const payload = {
        _id: `temp_${Date.now()}_${Math.random()}`,
        bookingId,
        text: text.trim(),
        sender: { _id: socket.user._id, name: socket.user.name },
        createdAt: new Date(),
        fromSocket: true,
      };
      io.to(`booking_${bookingId}`).emit('message:new', payload);

      if (receiverId) {
        io.to(`user_${receiverId}`).emit('notification:message', {
          from: socket.user.name, bookingId, preview: text.substring(0, 60),
        });
      }
    });

    socket.on('typing:start', ({ bookingId }) => {
      socket.to(`booking_${bookingId}`).emit('typing:start', { userId: socket.user._id, name: socket.user.name });
    });
    socket.on('typing:stop', ({ bookingId }) => {
      socket.to(`booking_${bookingId}`).emit('typing:stop', { userId: socket.user._id });
    });

    socket.on('booking:accept', ({ bookingId, passengerId }) => {
      io.to(`user_${passengerId}`).emit('booking:accepted', {
        bookingId, message: `${socket.user.name} accepted your ride!`,
      });
    });
    socket.on('booking:deny', ({ bookingId, passengerId, reason }) => {
      io.to(`user_${passengerId}`).emit('booking:denied', { bookingId, reason });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 ${socket.user.name} disconnected`);
    });
  });
  console.log('✅ Socket.IO handlers initialized');
};

module.exports = { initSocket };
