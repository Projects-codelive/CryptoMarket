import { useMemo } from 'react';
import useSWR from 'swr';
import api from '../api/axiosInstance';
import { useSocket } from '../context/SocketContext';

const fetcher = (url) => api.get(url).then(r => r.data);

const DEFAULT_COINS = [
  { market_symbol: 'BTC-INR', name: 'Bitcoin', price: 5380218.77, change_24h: 1.92, high_24h: 5405000, low_24h: 5245600, volume_24h: 124.58 },
  { market_symbol: 'ETH-INR', name: 'Ethereum', price: 295872.35, change_24h: -3.23, high_24h: 310000, low_24h: 280000, volume_24h: 854.58 },
  { market_symbol: 'SOL-INR', name: 'Solana', price: 5741.94, change_24h: -0.66, high_24h: 5943.80, low_24h: 5441.08, volume_24h: 3245.87 },
  { market_symbol: 'XRP-INR', name: 'Ripple', price: 48.47, change_24h: -1.64, high_24h: 50.80, low_24h: 47.39, volume_24h: 184512.90 },
  { market_symbol: 'DOGE-INR', name: 'Dogecoin', price: 12.04, change_24h: 3.65, high_24h: 12.62, low_24h: 11.45, volume_24h: 9845120.00 },
  { market_symbol: 'ADA-INR', name: 'Cardano', price: 40.26, change_24h: -3.65, high_24h: 42.50, low_24h: 39.18, volume_24h: 684512.00 },
  { market_symbol: 'BNB-INR', name: 'Binance Coin', price: 26823.50, change_24h: -1.22, high_24h: 27896.30, low_24h: 25984.20, volume_24h: 8945.20 },
];

export function useMarketData(symbol) {
  const { data, error, isLoading, mutate } = useSWR(
    symbol ? `/markets` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const { prices } = useSocket() || {};

  const dbCoins = (data || []).map(coin => {
    let market_symbol = coin.symbol ? coin.symbol.replace('_', '-') : `${coin.currency_symbol}-${coin.market_symbol}`;
    const def = DEFAULT_COINS.find(c => c.market_symbol === market_symbol);
    return {
      id: coin.id,
      market_symbol,
      name: coin.name || def?.name || coin.currency_symbol || '',
      price: coin.last_price || coin.initial_price || def?.price || 0,
      change_24h: coin.price_change_24h || def?.change_24h || 0,
      high_24h: coin.price_high_24h || def?.high_24h || 0,
      low_24h: coin.price_low_24h || def?.low_24h || 0,
      volume_24h: coin.volume_24h || def?.volume_24h || 0,
    };
  });

  const coinsMap = new Map();
  dbCoins.forEach(c => coinsMap.set(c.market_symbol, c));
  DEFAULT_COINS.forEach(c => {
    if (!coinsMap.has(c.market_symbol)) {
      coinsMap.set(c.market_symbol, c);
    }
  });

  const coins = Array.from(coinsMap.values());

  const normalizedSymbol = symbol ? symbol.replace(/[_/]/g, '-') : 'SOL-INR';
  const activeCoin = coins.find(c => c.market_symbol === normalizedSymbol) || DEFAULT_COINS.find(c => c.market_symbol === normalizedSymbol);

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
  const normalizedSymbol = symbol ? symbol.replace(/[_/]/g, '-') : 'SOL-INR';
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
    'SOL-INR': 5741.94,
    'BTC-INR': 5380218.77,
    'ETH-INR': 295872.35,
    'XRP-INR': 48.47,
    'DOGE-INR': 12.04,
    'ADA-INR': 40.26,
    'BNB-INR': 26823.50,
  };

  const basePrice = baseCoins[symbol] || 5741.94;
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
