import api from './axiosInstance';

export async function placeOrder(orderData) {
  const res = await api.post('/insertdata', orderData);
  return res.data;
}

export async function placeBuyOrder(data) {
  const res = await api.post('/buyorder', {
    market: data.market,
    buypricing: data.buypricing,
    buyamount: data.buyamount,
  });
  return res.data;
}

export async function placeSellOrder(data) {
  const res = await api.post('/sellorder', {
    market: data.market,
    sellpricing: data.sellpricing,
    sellamount: data.sellamount,
  });
  return res.data;
}

export async function cancelOrder(orderId) {
  const res = await api.post('/cancelorder', { order_id: orderId });
  return res.data;
}

export async function getOpenOrders(params) {
  const res = await api.get('/open-orders', { params });
  return res.data;
}

export async function getAllOpenOrders(userId) {
  const res = await api.get('/open-orders', { params: { user_id: userId } });
  return res.data;
}

export async function getOrderHistory(params) {
  const res = await api.get('/order-history', { params });
  return res.data;
}

export async function getAllOrderHistory(userId) {
  const res = await api.get('/order-history', { params: { user_id: userId, limit: 50 } });
  return res.data;
}

export async function getMyTrades(params) {
  const res = await api.get('/my-trades', { params });
  return res.data;
}

export async function getMarketTrades(params) {
  const res = await api.get('/market-trades', { params });
  return res.data;
}

export async function getHoldingsDetailed(userId) {
  const res = await api.get('/holdings-detailed', { params: { user_id: userId } });
  return res.data;
}
