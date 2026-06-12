/**
 * API Service — all endpoints wired (Razorpay edition)
 */
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach auth token to every request ────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rwu_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

// ── Global 401 → redirect to login ────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rwu_token');
      localStorage.removeItem('rwu_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ───────────────────────────────────────────────────────────
export const authAPI = {
  sendOTP:   (data) => api.post('/auth/send-otp', data),
  verifyOTP: (data) => api.post('/auth/verify-otp', data),
  getMe:     ()     => api.get('/auth/me'),
};

// ── Rides ──────────────────────────────────────────────────────────
export const ridesAPI = {
  create:         (data)          => api.post('/rides', data),
  search:         (params)        => api.get('/rides/search', { params }),
  getAll:         (params)        => api.get('/rides', { params }),
  getMy:          ()              => api.get('/rides/my'),
  getById:        (id)            => api.get(`/rides/${id}`),
  update:         (id, data)      => api.put(`/rides/${id}`, data),
  updateStatus:   (id, status)    => api.put(`/rides/${id}/status`, { status }),
  updateLocation: (id, lat, lng)  => api.put(`/rides/${id}/location`, { lat, lng }),
  cancel:         (id, reason)    => api.delete(`/rides/${id}`, { data: { reason } }),
};

// ── Bookings ───────────────────────────────────────────────────────
export const bookingsAPI = {
  create:          (data)         => api.post('/bookings', data),
  getMy:           ()             => api.get('/bookings/my'),
  getDriver:       ()             => api.get('/bookings/driver'),
  getById:         (id)           => api.get(`/bookings/${id}`),
  accept:          (id)           => api.put(`/bookings/${id}/accept`),
  deny:            (id, reason)   => api.put(`/bookings/${id}/deny`, { reason }),
  confirm:         (id)           => api.put(`/bookings/${id}/confirm`),   // alias
  cancel:          (id, reason)   => api.put(`/bookings/${id}/cancel`, { reason }),
  markPaymentDone: (id)           => api.put(`/bookings/${id}/payment-done`),
  rate:            (id, data)     => api.post(`/bookings/${id}/rate`, data),
};

// ── Payments (Razorpay) ────────────────────────────────────────────
export const paymentsAPI = {
  /**
   * createOrder — calls POST /payments/create-order
   * Returns { success, orderId, amount, currency, keyId }
   */
  createOrder: (bookingId) => api.post('/payments/create-order', { bookingId }),

  /**
   * verifyPayment — calls POST /payments/verify
   * Sends Razorpay callback fields for HMAC verification.
   * Returns { success, booking }
   */
  verifyPayment: (data) => api.post('/payments/verify', data),

  /**
   * getStatus — calls GET /payments/booking/:bookingId
   * Returns the Payment document for a booking.
   */
  getStatus: (bookingId) => api.get(`/payments/booking/${bookingId}`),

  /**
   * refund — calls POST /payments/refund/:bookingId  (admin only)
   */
  refund: (bookingId) => api.post(`/payments/refund/${bookingId}`),
};

// ── Messages ───────────────────────────────────────────────────────
export const messagesAPI = {
  send:             (data)      => api.post('/messages', data),
  getHistory:       (bookingId) => api.get(`/messages/${bookingId}`),
  getConversations: ()          => api.get('/messages/conversations'),
};

// ── Users ──────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile:    ()     => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  updateVehicle: (data) => api.put('/users/vehicle', data),
  getStats:      ()     => api.get('/users/stats'),
  getById:       (id)   => api.get(`/users/${id}`),
};

// ── Admin ──────────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard:   ()       => api.get('/admin/dashboard'),
  getUsers:       (params) => api.get('/admin/users', { params }),
  getRides:       (params) => api.get('/admin/rides', { params }),
  deleteRide:     (id)     => api.delete(`/admin/rides/${id}`),
  getBookings:    (params) => api.get('/admin/bookings', { params }),
  deactivateUser: (id)     => api.put(`/admin/users/${id}/deactivate`),
  activateUser:   (id)     => api.put(`/admin/users/${id}/activate`),
  makeAdmin:      (id)     => api.put(`/admin/users/${id}/make-admin`),
  getRevenue:     ()       => api.get('/admin/revenue'),
};

export default api;
