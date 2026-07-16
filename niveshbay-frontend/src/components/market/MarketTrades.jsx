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
        const newTrade = {
          price: parseFloat(latestTrade.price),
          amount: parseFloat(latestTrade.qty),
          total: parseFloat(latestTrade.amount_usdt),
          time: new Date(latestTrade.timestamp).toISOString(),
          id: Date.now(),
        };
        setTrades(prev => [newTrade, ...prev].slice(0, 50));
      }
    }
  }, [tradeUpdates, dbSymbol]);

  return (
    <div className="px-3">
      <div className="flex text-[10px] text-[#848e9c] py-1 border-b border-[#2b2f36]">
        <span className="flex-1">Price(USDT)</span>
        <span className="w-16 text-right">Amount</span>
        <span className="w-14 text-right">Time</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {trades.slice(0, 30).map((t, i) => {
          const prevPrice = prevPricesRef.current[t.id] || t.price;
          const isUp = t.price >= prevPrice;
          prevPricesRef.current[t.id] = t.price;
          return (
            <div key={t.id || i} className="flex text-[11px] py-0.5">
              <span className={`flex-1 ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {formatINR(t.price)}
              </span>
              <span className="w-16 text-right text-white">{formatAmount(t.amount)}</span>
              <span className="w-14 text-right text-[#848e9c]">
                {t.time ? new Date(t.time).toLocaleTimeString() : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
