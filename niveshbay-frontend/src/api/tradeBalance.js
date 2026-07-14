import api from './axiosInstance';

// ── Trade History ─────────────────────────────────────────────────────────────
// Calls the new /api/v1/trade-history endpoint
export async function getTradeHistory(params = {}) {
  const res = await api.get('/api/v1/trade-history', { params });
  return res.data;
}

// ── Balance Log ───────────────────────────────────────────────────────────────
// Reuses the existing /api/v1/wallet/history endpoint
// Params: type, asset, from, to, limit, offset
export async function getBalanceLog(params = {}) {
  const res = await api.get('/api/v1/wallet/history', { params });
  return res.data;
}

// ── Coin list for filter dropdown ─────────────────────────────────────────────
// Reuses existing /currency_symbols endpoint
export async function getCoinSymbols() {
  const res = await api.get('/currency_symbols');
  return res.data;
}
