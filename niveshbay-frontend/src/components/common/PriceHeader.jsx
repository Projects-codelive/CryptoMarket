import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { formatINR, formatCurrency } from '../../utils/formatCurrency';
import { useMarketData } from '../../hooks/useMarketData';
import api from '../../api/axiosInstance';

export default function PriceHeader({ symbol }) {
  const { activeCoin } = useMarketData(symbol);
  const { prices } = useSocket() || {};
  const prevPriceRef = useRef(null);

  const currencySymbol = activeCoin?.currency_symbol || symbol?.split(/[-_/]/)[0] || 'SOL';
  const quoteSymbol = activeCoin?.quote_symbol || symbol?.split(/[-_/]/)[1] || 'INR';

  const dbSymbol = activeCoin?.symbol_db || (symbol ? symbol.replace('-', '_') : 'SOL_INR');
  const normalizedSymbol = symbol?.replace(/[_/]/g, '-') || 'SOL-INR';
  const livePrice = prices?.[normalizedSymbol];

  const [price, setPrice] = useState(0);
  const [change, setChange] = useState(0);
  const [high, setHigh] = useState(0);
  const [low, setLow] = useState(0);
  const [vol, setVol] = useState(0);
  const [direction, setDirection] = useState('neutral');
  const [loaded, setLoaded] = useState(false);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await api.get('/latest-price', { params: { market_symbol: dbSymbol } });
      if (res.data) {
        setPrice(parseFloat(res.data.price) || 0);
        if (res.data.change_percent_24h !== undefined) {
          setChange(parseFloat(res.data.change_percent_24h) || 0);
        } else if (res.data.change_24h !== undefined && res.data.price) {
          const raw = parseFloat(res.data.change_24h);
          const price = parseFloat(res.data.price);
          const prev = price - raw;
          setChange(prev > 0 ? (raw / prev) * 100 : 0);
        } else {
          setChange(0);
        }
        setHigh(parseFloat(res.data.high_24h) || 0);
        setLow(parseFloat(res.data.low_24h) || 0);
        setVol(parseFloat(res.data.volume_24h) || 0);
        setLoaded(true);
      }
    } catch {
      // fallback — will get data from socket
    }
  }, [dbSymbol]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    if (livePrice?.price !== undefined) {
      const newPrice = livePrice.price;
      if (prevPriceRef.current !== null) {
        if (newPrice > prevPriceRef.current) setDirection('up');
        else if (newPrice < prevPriceRef.current) setDirection('down');
      } else {
        setDirection('neutral');
      }
      prevPriceRef.current = newPrice;
      setPrice(newPrice);
      if (livePrice.change_percent_24h !== undefined) {
        setChange(livePrice.change_percent_24h);
      } else if (livePrice.price_change_24h !== undefined && livePrice.price) {
        const prev = livePrice.price - livePrice.price_change_24h;
        setChange(prev > 0 ? (livePrice.price_change_24h / prev) * 100 : 0);
      }
      if (livePrice.high_24h !== undefined) setHigh(livePrice.high_24h);
      if (livePrice.low_24h !== undefined) setLow(livePrice.low_24h);
      if (livePrice.volume_24h !== undefined) setVol(livePrice.volume_24h);
      setLoaded(true);
    }
  }, [livePrice]);

  const displayPrice = price || activeCoin?.price || 0;
  const displayChange = change || activeCoin?.change_24h || 0;
  const displayHigh = high || activeCoin?.high_24h || 0;
  const displayLow = low || activeCoin?.low_24h || 0;
  const displayVol = vol || activeCoin?.volume_24h || 0;

  const isPositive = displayChange >= 0;
  const priceColor = direction === 'up' ? '#0ecb81' : direction === 'down' ? '#f6465d' : (isPositive ? '#0ecb81' : '#f6465d');

  if (!loaded) {
    return (
      <div className="flex items-center gap-4 px-4 py-1.5 bg-[#0b0f19] border-b border-[#1e2433] text-xs">
        <span className="text-white font-bold text-sm">{currencySymbol}/{quoteSymbol}</span>
        <span className="text-lg font-bold text-[#848e9c]">--</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-[#0b0f19] border-b border-[#1e2433] text-xs">
      <span className="text-white font-bold text-sm">{currencySymbol}/{quoteSymbol}</span>
      <span className="text-lg font-bold" style={{ color: priceColor }}>
        {displayPrice ? formatCurrency(displayPrice, quoteSymbol) : '--'}
      </span>
      <span className={isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
        {displayChange ? `${isPositive ? '+' : ''}${Number(displayChange).toFixed(2)}%` : '0.00%'}
      </span>
      <span className="text-[#848e9c]">24h High: <span className="text-white">{displayHigh ? formatCurrency(displayHigh, quoteSymbol) : '--'}</span></span>
      <span className="text-[#848e9c]">24h Low: <span className="text-white">{displayLow ? formatCurrency(displayLow, quoteSymbol) : '--'}</span></span>
      <span className="text-[#848e9c]">24h Vol: <span className="text-white">{displayVol ? Number(displayVol).toLocaleString('en-IN') : '0'}</span></span>
    </div>
  );
}
