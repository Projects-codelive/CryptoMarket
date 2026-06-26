import api from './axiosInstance';

export async function getCoins() {
  const res = await api.get('/markets');
  return res.data;
}

export async function getCryptoCoins() {
  const res = await api.get('/currency_symbols');
  return res.data;
}

export async function getCoinHistory(params = {}) {
  const res = await api.get('/coin_history', { params });
  return res.data;
}

export async function getOrderBook(symbol) {
  const res = await api.get('/openorder', { params: { market_symbol: symbol } });
  return res.data;
}

export async function getBuyOrders(symbol) {
  const res = await api.get('/openbuyorder', { params: { market_symbol: symbol } });
  return res.data;
}

export async function getSellOrders(symbol) {
  const res = await api.get('/opensellorder', { params: { market_symbol: symbol } });
  return res.data;
}

export async function getCompletedOrders(symbol) {
  const res = await api.get('/completed_orders', { params: { market_symbol: symbol } });
  return res.data;
}
