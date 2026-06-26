import useSWR from 'swr';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';

const fetcher = (url) => api.get(url).then(r => r.data);

export function usePortfolio() {
  const { user } = useAuth();

  const { data: balance, mutate: refreshBalance } = useSWR(
    user ? `/balance?user_id=${user.user_id}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: holdings, mutate: refreshHoldings } = useSWR(
    user ? `/holdings-detailed?user_id=${user.user_id}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const { data: openOrders, mutate: refreshOpenOrders } = useSWR(
    user ? `/open-orders?user_id=${user.user_id}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: orderHistory, mutate: refreshOrderHistory } = useSWR(
    user ? `/order-history?user_id=${user.user_id}&limit=50` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const { data: myTrades, mutate: refreshMyTrades } = useSWR(
    user ? `/my-trades?user_id=${user.user_id}&limit=50` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  return {
    balance: balance?.balance || 0,
    holdings: holdings || [],
    openOrders: openOrders || [],
    orderHistory: orderHistory || [],
    myTrades: myTrades || [],
    refreshBalance,
    refreshHoldings,
    refreshOpenOrders,
    refreshOrderHistory,
    refreshMyTrades,
  };
}
