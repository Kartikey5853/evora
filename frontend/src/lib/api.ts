import axios from 'axios';

// Configure base URL - can be changed for production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Auth endpoints
export const authAPI = {
  // OTP registration
  registerStart: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register-start', data),
  registerVerify: (data: { email: string; otp: string }) =>
    api.post('/auth/register-verify', data),

  // OTP login
  loginRequest: (data: { email: string; password: string }) =>
    api.post('/auth/login-request', data),
  loginVerify: (data: { email: string; otp: string }) =>
    api.post('/auth/login-verify', data),

  // Direct login
  loginDirect: (data: { email: string; password: string }) =>
    api.post('/auth/login-direct', data),

  // Google (ID token)
  googleAuth: (data: { credential: string; role?: 'user' | 'admin' }) =>
    api.post('/auth/google', data),

  // password management
  forgotPassword: (data: { email: string }) => api.post('/auth/forgot-password', data),
  resetPassword: (data: { email: string; otp: string; new_password: string }) =>
    api.post('/auth/reset-password', data),

  changePassword: (data: { old_password: string; new_password: string }) =>
    api.post('/auth/change-password', data),

  me: () => api.get('/users/me'),
  updateMe: (data: { name?: string; profile_pic_url?: string; is_profile_complete?: boolean }) => api.patch('/users/me', data),

  uploadProfilePicture: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/users/me/profile-picture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeProfilePicture: () => api.delete('/users/me/profile-picture'),
};

// Admin auth endpoints
export const adminAuthAPI = {
  registerStart: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/admin/register-start', data),
  registerVerify: (data: { email: string; otp: string }) =>
    api.post('/auth/admin/register-verify', data),
  loginRequest: (data: { email: string; password: string }) =>
    api.post('/auth/admin/login-request', data),
  loginVerify: (data: { email: string; otp: string }) =>
    api.post('/auth/admin/login-verify', data),

  // Direct login
  loginDirect: (data: { email: string; password: string }) =>
    api.post('/auth/admin/login-direct', data),

  googleAuth: (data: { credential: string }) => api.post('/auth/google', { ...data, role: 'admin' }),
  me: () => api.get('/admin/me'),
  updateMe: (data: { name?: string; profile_pic_url?: string }) => api.patch('/admin/me', data),

  uploadProfilePicture: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/admin/me/profile-picture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeProfilePicture: () => api.delete('/admin/me/profile-picture'),
};

// Car endpoints
export const carAPI = {
  getCars: () => api.get('/cars'),

  addCar: (data: {
    brand: string;
    model: string;
    car_number: string;
    charger_type: string;
  }) => api.post('/cars', data),

  addEmergencyCar: (data: {
    brand: string;
    model: string;
    car_number: string;
    charger_type: string;
    emergency_type: 'POLICE' | 'AMBULANCE' | 'FIRE';
    emergency_proof_url: string;
  }) => api.post('/cars/emergency', data),

  deleteCar: (id: string) => api.delete(`/cars/${id}`),
};

// Booking endpoints
export const bookingAPI = {
  getBookings: () => api.get('/bookings'),
  createBooking: (data: {
    car_id: string
    station_id: string
    slot_id: string
    order_id: string
    transaction_id: string
    amount: number
  }) => api.post("/bookings", data),

  // truth-layer booking (30-min window)
  createBookingV2: (data: {
    charger_id: string
    station_id: string
    car_id: string
    date: string
    start_time: string // HH:MM
    duration_minutes: number
  }) => api.post("/bookings/v2", data),

  // QR scan (deterministic)
  scan: (bookingId: string, data: { bypass_mode?: boolean }) => api.post(`/bookings/${bookingId}/scan`, {
    bypass_mode: Boolean(data?.bypass_mode),
  }),

  getMyBookings: () => api.get("/bookings"),

  // Transactions (truth-layer)
  getMyBookingHistory: () => api.get("/bookings/my"),

  cancelBooking: (bookingId: string) => api.post(`/bookings/${bookingId}/cancel`),
}

// Station endpoints (admin)
export const stationAPI = {
  getStations: () => api.get('/stations'),
  getStationById: (stationId: string) => api.get(`/stations/${stationId}`),
  addStation: (data: { name: string; address: string; latitude: string | number; longitude: string | number; host_id?: string; document_url?: string }) =>
    api.post('/stations', {
      ...data,
      host_id: data.host_id ?? 'admin-host-id',
      latitude: String(data.latitude),
      longitude: String(data.longitude),
      document_url: data.document_url || '',
    }),
  updateStation: (stationId: string, data: Partial<{ name: string; address: string; latitude: string; longitude: string; is_active: boolean }>) =>
    api.put(`/stations/${stationId}`, data),
  deleteStation: (id: string) => api.delete(`/stations/${id}`),

  // nearby stations
  getNearbyStations: (lat: number, lng: number) =>
    api.get(`/stations/nearby?lat=${lat}&lng=${lng}`),
  // read-only availability
  getAvailability: (stationId: string) =>
    api.get(`/stations/${stationId}/availability`),

  // Admin helpers
  getChargersWithSlots: (stationId: string) => api.get(`/stations/${stationId}/chargers-with-slots`),
};

// Charger endpoints (admin)
export const chargerAPI = {
  getChargers: (stationId: string) => api.get(`/stations/${stationId}/chargers`),
  addCharger: (stationId: string, data: { charger_type: string; power_kw: number; price_per_hour?: number }) =>
    api.post(`/stations/${stationId}/chargers`, data),
  deleteCharger: (chargerId: string) => api.delete(`/stations/chargers/${chargerId}`),
};

// Slot endpoints (admin)
export const slotAPI = {
  // User-side: fetch slots for a station
  getSlots: (stationId: string) =>
    api.get(`/stations/${stationId}/slots`),

  // Admin-side: add slot to a station
  addSlot: (
    stationId: string,
    data: {
      charger_id: string
      start_time: string
      end_time: string
    }
  ) =>
    api.post(`/stations/${stationId}/slots`, data),

  // ---- truth-layer slot engine ----
  generate3Days: (chargerId: string, data: { open_time: string; close_time: string; price_override?: number | null }) =>
    api.post(`/slots/generate-3days/${chargerId}`, data),

  getWindows: (chargerId: string, date: string) =>
    api.get(`/slots/windows`, { params: { charger_id: chargerId, date } }),

  // Admin micro-slot listing + editing
  getMicroSlotsByCharger: (chargerId: string, date: string) =>
    api.get(`/slots/by-charger`, { params: { charger_id: chargerId, date } }),

  patchSlot: (slotId: string, data: { status?: string; price_override?: number | null; is_emergency_slot?: boolean }) =>
    api.patch(`/slots/${slotId}`, data),

  // Admin-side: view all slots with booking + user + car info
  getAdminSlots: () =>
    api.get(`/slots/admin/slots`),

  // Count available slots for a station
  getAvailableCount: (stationId: string) => api.get(`/slots/count`, { params: { station_id: stationId } }),

  // Admin bookings grouped by booking_status (replaces /slots/admin/windows)
  getAdminBookings: (params: { station_id?: string; date?: string }) =>
    api.get(`/admin/bookings`, { params }),
}

// Dev override endpoints
export const devAPI = {
  getOverrides: () => api.get('/dev/overrides'),
  toggleBypass: () => api.post('/dev/toggle-bypass'),
  adminScan: (data: { ticket_id?: string; booking_id?: string }) =>
    api.post('/dev/admin-scan', data),
  graceTest: (bookingId: string) => api.post(`/dev/grace-test/${bookingId}`),
  graceArrive: (bookingId: string) => api.post(`/dev/grace-arrive/${bookingId}`),
  graceNoShow: (bookingId: string) => api.post(`/dev/grace-noshow/${bookingId}`),
  forceComplete: (bookingId: string) => api.post(`/dev/force-complete/${bookingId}`),
  walkIn: (data: { car_number: string; charger_id: string; duration_minutes?: number }) =>
    api.post('/dev/walk-in', data),
  bypassArrival: (bookingId: string) => api.post(`/dev/bypass-arrival/${bookingId}`),
  emergencyOverride: (data: { car_id: string; charger_id: string; slot_start: string; slot_end: string }) =>
    api.post('/dev/emergency-override', data),
};

// Superadmin endpoints
export const superadminAPI = {
  login: (data: { email: string; password: string }) =>
    api.post('/superadmin/login', data),
  getEmergencyRequests: () => api.get('/superadmin/emergency-requests'),
  approveRequest: (carId: string) => api.post(`/superadmin/emergency-requests/${carId}/approve`),
  rejectRequest: (carId: string) => api.post(`/superadmin/emergency-requests/${carId}/reject`),
  // Station approval
  getStationRequests: () => api.get('/superadmin/station-requests'),
  approveStation: (stationId: string) => api.post(`/superadmin/station-requests/${stationId}/approve`),
  rejectStation: (stationId: string) => api.post(`/superadmin/station-requests/${stationId}/reject`),
};

// Message endpoints
export const messageAPI = {
  sendAsUser: (data: {
    receiver_id: string;
    receiver_role: string;
    booking_id?: string;
    station_id?: string;
    content: string;
  }) => api.post('/messages/user', data),

  sendAsAdmin: (data: {
    receiver_id: string;
    receiver_role: string;
    booking_id?: string;
    station_id?: string;
    content: string;
  }) => api.post('/messages/admin', data),

  getByBooking: (bookingId: string) => api.get(`/messages/booking/${bookingId}`),
  getByStation: (stationId: string) => api.get(`/messages/station/${stationId}`),
  getStationUserMessages: (stationId: string, userId: string) =>
    api.get(`/messages/station/${stationId}/user/${userId}`),

  getUserThreads: () => api.get('/messages/user/threads'),
  getAdminThreads: () => api.get('/messages/admin/threads'),
  getAdminBookingsForChat: () => api.get('/messages/admin/bookings-for-chat'),
  getUserStationsForChat: () => api.get('/messages/user/stations-for-chat'),
  getAdminStationThreads: () => api.get('/messages/admin/station-threads'),
};

// Wallet endpoints
export const walletAPI = {
  getBalance: () => api.get('/wallet/balance'),
  addFunds: (amount: number) => api.post('/wallet/add-funds', { amount }),
  getTransactions: () => api.get('/wallet/transactions'),
  // Host wallet
  getHostBalance: () => api.get('/wallet/host/balance'),
  hostWithdraw: (amount: number) => api.post('/wallet/host/withdraw', { amount }),
};

// Admin analytics
export const adminAnalyticsAPI = {
  getEarnings: (days?: number) => api.get('/admin/earnings', { params: { days: days || 30 } }),
  getPeakHours: (days?: number) => api.get('/admin/peak-hours', { params: { days: days || 30 } }),
  getRevenueSplit: (bookingId: string) => api.get(`/admin/revenue-split/${bookingId}`),
};

// Bookable cars (filters out unapproved emergency vehicles)
export const bookableCarAPI = {
  getBookableCars: () => api.get('/cars/bookable'),
};

export default api;
