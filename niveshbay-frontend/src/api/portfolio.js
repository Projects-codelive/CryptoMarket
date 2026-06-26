import api from './axiosInstance';

export async function getBalance(userId) {
  try {
    const res = await api.get('/balance', { params: { user_id: userId } });
    return res.data;
  } catch {
    return { balance: 0 };
  }
}

export async function getHoldings(userId) {
  try {
    const res = await api.get('/holdings-detailed', { params: { user_id: userId } });
    return res.data;
  } catch {
    return [];
  }
}

export async function getPortfolio(userId) {
  try {
    const res = await api.get('/portfolio', { params: { user_id: userId } });
    return res.data;
  } catch {
    return { total_value_inr: 0, holdings: [] };
  }
}
