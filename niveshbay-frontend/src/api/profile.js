// api/profile.js
// Existing getProfile + updateProfile are UNCHANGED.
// Added: getKyc, saveKyc, getBankDetails, saveBankDetails

import api from './axiosInstance';

// ── Existing (unchanged) ─────────────────────────────────────────────────────

export async function getProfile() {
  const res = await api.get('/profile');
  return res.data;
}

export async function updateProfile(data) {
  const res = await api.put('/profile', data);
  return res.data;
}

// ── New: KYC ─────────────────────────────────────────────────────────────────

export async function getKyc() {
  const res = await api.get('/api/v1/kyc');
  return res.data;
}

export async function saveKyc(data) {
  const res = await api.post('/api/v1/kyc', data);
  return res.data;
}

// ── New: Bank Details ─────────────────────────────────────────────────────────

export async function getBankDetails() {
  const res = await api.get('/api/v1/bank-details');
  return res.data;
}

export async function saveBankDetails(data) {
  const res = await api.post('/api/v1/bank-details', data);
  return res.data;
}