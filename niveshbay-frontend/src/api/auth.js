import api from './axiosInstance';

export async function registerUser(data) {
  const res = await api.post('/create', {
    name: data.name,
    phone: data.phone,
    email: data.email,
    password: data.password,
    referral_id: data.referral_id || '',
  });
  return res.data;
}

export async function loginUser(data) {
  const res = await api.post('/login', {
    email: data.email,
    password: data.password,
  });
  return res.data;
}

export async function getMe() {
  const res = await api.get('/me');
  return res.data;
}

export async function sendOtp(data) {
  const res = await api.post('/send-otp', {
    email: data.email,
    phone: data.phone,
    purpose: data.purpose,
  });
  return res.data;
}

export async function verifyOtp(data) {
  const res = await api.post('/verify-otp', {
    email: data.email,
    otp: data.otp,
    purpose: data.purpose,
  });
  return res.data;
}

export async function resetPassword(data) {
  const res = await api.post('/reset-password', {
    email: data.email,
    newPassword: data.newPassword,
    confirmPassword: data.confirmPassword,
  });
  return res.data;
}
