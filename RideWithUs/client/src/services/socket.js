/**
 * Socket.IO Client Service — singleton
 * Usage:
 *   import socketService from './services/socket';
 *   socketService.connect(token);
 *   socketService.joinRide(rideId);
 *   socketService.on('driver:location', cb);
 */

import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
    });
    this.socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
    });
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ── Ride tracking ───────────────────────────────────────────
  joinRide(rideId)  { this.socket?.emit('ride:join',  { rideId }); }
  leaveRide(rideId) { this.socket?.emit('ride:leave', { rideId }); }

  sendLocation(rideId, lat, lng) {
    this.socket?.emit('driver:updateLocation', { rideId, lat, lng });
  }

  updateRideStatus(rideId, status) {
    this.socket?.emit('ride:updateStatus', { rideId, status });
  }

  // ── Chat ────────────────────────────────────────────────────
  joinBooking(bookingId)  { this.socket?.emit('booking:join',  { bookingId }); }
  leaveBooking(bookingId) { this.socket?.emit('booking:leave', { bookingId }); }

  sendMessage(bookingId, text, receiverId) {
    this.socket?.emit('message:send', { bookingId, text, receiverId });
  }

  typingStart(bookingId) { this.socket?.emit('typing:start', { bookingId }); }
  typingStop(bookingId)  { this.socket?.emit('typing:stop',  { bookingId }); }

  // ── Generic event listeners ─────────────────────────────────
  on(event, cb)  { this.socket?.on(event, cb); }
  off(event, cb) { this.socket?.off(event, cb); }

  isConnected() { return this.socket?.connected || false; }
}

// Export a singleton
const socketService = new SocketService();
export default socketService;
