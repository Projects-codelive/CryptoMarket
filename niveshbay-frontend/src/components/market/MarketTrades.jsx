import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { formatINR, formatAmount } from '../../utils/formatCurrency';
import api from '../../api/axiosInstance';

export default function MarketTrades({ symbol }) {
  const [trades, setTrades] = useState([]);
  const { tradeUpdates } = useSocket() || {};
  const dbSymbol = symbol ? symbol.replace('-', '_') : 'SOL_USDT';
  const prevPricesRef = useRef({});

  useEffect(() => {
    api.get('/market-trades', { params: { market_symbol: dbSymbol, limit: 50 } })
      .then(res => {
        const data = (res.data || []).map(t => ({
          price: parseFloat(t.bid_price),
          amount: parseFloat(t.complete_qty),
          total: parseFloat(t.complete_amount),
          time: t.success_time,
          id: t.log_id || Math.random(),
        }));
        setTrades(data);
      })
      .catch(() => {});
  }, [dbSymbol]);

  useEffect(() => {
    if (tradeUpdates && tradeUpdates.length > 0) {
      const latestTrade = tradeUpdates[0];
      if (latestTrade.market_symbol === dbSymbol) {
        const newPrice = parseFloat(latestTrade.price);
        const newAmount = parseFloat(latestTrade.qty);
        const newTime = new Date(latestTrade.timestamp).toISOString();
        setTrades(prev => {
          const isDuplicate = prev.some(
            t => t.price === newPrice && t.amount === newAmount && t.time === newTime
          );
          if (isDuplicate) return prev;
          return [{ price: newPrice, amount: newAmount, total: parseFloat(latestTrade.amount_usdt), time: newTime, id: `ws-${newTime}-${newPrice}-${newAmount}` }, ...prev].slice(0, 50);
        });
      }
    }
  }, [tradeUpdates, dbSymbol]);

  return (
    <div className="px-3">
      <div className="flex text-[10px] text-[#848e9c] py-1 border-b border-[#2b2f36]">
        <span className="w-[40%]">Price(USDT)</span>
        <span className="w-[30%] text-right shrink-0 whitespace-nowrap">Amount</span>
        <span className="w-[30%] text-right shrink-0 whitespace-nowrap">Time</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {trades.slice(0, 30).map((t, i) => {
          const prevPrice = prevPricesRef.current[t.id] || t.price;
          const isUp = t.price >= prevPrice;
          prevPricesRef.current[t.id] = t.price;
          return (
            <div key={t.id || i} className="flex text-[11px] py-0.5">
              <span className={`w-[40%] truncate ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {formatINR(t.price)}
              </span>
              <span className="w-[30%] text-right shrink-0 whitespace-nowrap text-white">{formatAmount(t.amount)}</span>
              <span className="w-[30%] text-right shrink-0 whitespace-nowrap text-[#848e9c]">
                {t.time ? new Date(t.time).toLocaleTimeString() : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
