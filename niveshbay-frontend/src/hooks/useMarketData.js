import { useMemo } from 'react';
import useSWR from 'swr';
import api from '../api/axiosInstance';
import { useSocket } from '../context/SocketContext';

const fetcher = (url) => api.get(url).then(r => r.data);

const DEFAULT_COINS = [
  { market_symbol: 'BTC-USDT', name: 'Bitcoin', price: 64000, change_24h: 1.92, high_24h: 65000, low_24h: 62500, volume_24h: 124.58 },
  { market_symbol: 'ETH-USDT', name: 'Ethereum', price: 3500, change_24h: -3.23, high_24h: 3700, low_24h: 3350, volume_24h: 854.58 },
  { market_symbol: 'SOL-USDT', name: 'Solana', price: 68, change_24h: -0.66, high_24h: 71, low_24h: 65, volume_24h: 3245.87 },
  { market_symbol: 'XRP-USDT', name: 'Ripple', price: 0.58, change_24h: -1.64, high_24h: 0.61, low_24h: 0.57, volume_24h: 184512.90 },
  { market_symbol: 'DOGE-USDT', name: 'Dogecoin', price: 0.14, change_24h: 3.65, high_24h: 0.15, low_24h: 0.135, volume_24h: 9845120.00 },
  { market_symbol: 'ADA-USDT', name: 'Cardano', price: 0.48, change_24h: -3.65, high_24h: 0.51, low_24h: 0.47, volume_24h: 684512.00 },
  { market_symbol: 'BNB-USDT', name: 'Binance Coin', price: 320, change_24h: -1.22, high_24h: 335, low_24h: 312, volume_24h: 8945.20 },
];

export function useMarketData(symbol) {
  const { data, error, isLoading, mutate } = useSWR(
    '/markets',
    fetcher,
    { refreshInterval: 10000 }
  );

  const { prices } = useSocket() || {};

  const dbCoins = useMemo(() => {
    return (data || []).map(coin => {
      let market_symbol = coin.symbol ? coin.symbol.replace('_', '-') : `${coin.currency_symbol}-${coin.market_symbol}`;
      const def = DEFAULT_COINS.find(c => c.market_symbol === market_symbol);
      
      let price = parseFloat(coin.last_price || coin.initial_price || def?.price || 0);
      let change_24h = parseFloat(coin.price_change_24h || def?.change_24h || 0);
      let high_24h = parseFloat(coin.price_high_24h || def?.high_24h || 0);
      let low_24h = parseFloat(coin.price_low_24h || def?.low_24h || 0);
      let volume_24h = parseFloat(coin.volume_24h || def?.volume_24h || 0);

      if (price <= 0) {
        const usdtCounterpart = DEFAULT_COINS.find(c => c.market_symbol === `${coin.currency_symbol}-USDT`);
        if (usdtCounterpart) {
          price = usdtCounterpart.price;
          change_24h = usdtCounterpart.change_24h;
          high_24h = usdtCounterpart.high_24h;
          low_24h = usdtCounterpart.low_24h;
          volume_24h = usdtCounterpart.volume_24h;
        }
      }

      return {
        id: coin.id,
        market_symbol,
        currency_symbol: coin.currency_symbol || market_symbol.split('-')[0],
        quote_symbol: coin.market_symbol || market_symbol.split('-')[1],
        symbol_db: coin.symbol || `${coin.currency_symbol}_${coin.market_symbol}`,
        name: coin.name || def?.name || coin.currency_symbol || '',
        price,
        change_24h,
        high_24h,
        low_24h,
        volume_24h,
      };
    });
  }, [data]);

  const coins = useMemo(() => {
    if (!data) {
      return [];
    }
    return dbCoins;
  }, [data, dbCoins]);

  const normalizedSymbol = symbol ? symbol.replace(/[_/]/g, '-') : 'SOL-USDT';
  const activeCoin = coins.find(c => c.market_symbol === normalizedSymbol);

  const livePrice = prices?.[normalizedSymbol];

  return {
    coins,
    activeCoin,
    livePrice,
    isLoading,
    error,
    mutate,
  };
}

export function useCoinHistory(symbol, interval = '1m') {
  const normalizedSymbol = symbol ? symbol.replace(/[_/]/g, '-') : 'SOL-USDT';
  const dbSymbol = normalizedSymbol.replace('-', '_');

  const { data, error, mutate } = useSWR(
    symbol ? `/coin_history?market_symbol=${dbSymbol}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const mockHistory = useMemo(() => generateMockHistory(normalizedSymbol), [normalizedSymbol]);

  const history = data && data.length > 0 ? data : mockHistory;

  return {
    history,
    isLoading: !error && !data && history.length === 0,
    error,
    refreshHistory: mutate,
  };
}

function generateMockHistory(symbol) {
  const baseCoins = {
    'SOL-USDT': 68,
    'BTC-USDT': 64000,
    'ETH-USDT': 3500,
    'XRP-USDT': 0.58,
    'DOGE-USDT': 0.14,
    'ADA-USDT': 0.48,
    'BNB-USDT': 320,
  };

  const basePrice = baseCoins[symbol] || 68;
  const candleCount = 100;
  const data = [];
  const now = new Date();

  let price = basePrice * 0.98;

  for (let i = 0; i < candleCount; i++) {
    const date = new Date(now.getTime() - (candleCount - i) * 60 * 1000);
    const change = (Math.random() - 0.49) * (basePrice * 0.005);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.003);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.003);

    data.push({
      id: i,
      coin_symbol: symbol.split('-')[0],
      market_symbol: symbol,
      last_price: close,
      open,
      close,
      high,
      low,
      date: date.toISOString(),
      created_at: date.toISOString(),
    });

    price = close;
  }

  return data;
}
