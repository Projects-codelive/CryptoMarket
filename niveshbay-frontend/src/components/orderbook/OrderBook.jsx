import { useState, useMemo, useCallback, useRef } from 'react';
import { useOrderBook } from '../../hooks/useOrderBook';
import { formatINR, formatAmount } from '../../utils/formatCurrency';

export default function OrderBook({ symbol, onSellFormFill }) {
  const { bids, asks } = useOrderBook(symbol);
  const [rounding, setRounding] = useState('0.01');
  const [tooltip, setTooltip] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [flashRow, setFlashRow] = useState(null);
  const hoverTimerRef = useRef(null);

  const base = symbol?.split('-')[0] || 'SOL';

  const sortedAsks = useMemo(() =>
    [...asks].sort((a, b) => a.price - b.price).slice(0, 8),
    [asks]
  );

  const sortedBids = useMemo(() =>
    [...bids].sort((a, b) => b.price - a.price).slice(0, 8),
    [bids]
  );

  const asksWithCumulative = useMemo(() => {
    let cum = 0;
    return sortedAsks.map(a => { cum += a.amount; return { ...a, cumulative: cum }; });
  }, [sortedAsks]);

  const bidsWithCumulative = useMemo(() => {
    let cum = 0;
    return sortedBids.map(b => { cum += b.amount; return { ...b, cumulative: cum }; });
  }, [sortedBids]);

  const currentPriceINR = sortedBids.length > 0
    ? (sortedBids[0].price + (sortedAsks[0]?.price || sortedBids[0].price)) / 2
    : 0;

  const maxAmount = useMemo(() => {
    const amounts = [...sortedAsks, ...sortedBids].map(x => x.amount);
    return Math.max(...amounts, 1);
  }, [sortedAsks, sortedBids]);

  const getCumulativeForRow = useCallback((row, side) => {
    const list = side === 'SELL' ? asksWithCumulative : bidsWithCumulative;
    const found = list.find(r => r.price === row.price);
    if (!found) return { cumulative: row.amount || 0, sumInr: 0, avgPrice: 0 };
    const sumInr = found.cumulative * found.price;
    return {
      cumulative: found.cumulative,
      sumInr,
      avgPrice: sumInr / found.cumulative,
    };
  }, [asksWithCumulative, bidsWithCumulative]);

  const handleMouseEnter = useCallback((row, side) => {
    setHoveredRow(row);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

    hoverTimerRef.current = setTimeout(() => {
      const info = getCumulativeForRow(row, side);
      setTooltip({ sum_coin: info.cumulative, sum_inr: info.sumInr, avg_price: info.avgPrice });
    }, 150);
  }, [getCumulativeForRow]);

  const handleMouseLeave = useCallback(() => {
    setHoveredRow(null);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setTooltip(null);
  }, []);

  const handleRowClick = useCallback((row, side) => {
    if (!onSellFormFill) return;
    onSellFormFill({
      price: row.price,
      amount: row.cumulative || row.amount,
    });
    setFlashRow(row.price + side);
    setTimeout(() => setFlashRow(null), 300);
  }, [onSellFormFill]);

  return (
    <div className="w-[280px] bg-[#141822] border-r border-[#1e2433] flex flex-col shrink-0 select-none h-full relative">
      <div className="px-3 py-2 border-b border-[#1e2433] flex items-center justify-between">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider">Order Book</h3>
        <div className="flex bg-[#0b0f19] border border-[#2b3548] rounded p-0.5 text-[10px] font-bold">
          {['0.01', '0.1', '1'].map(r => (
            <button
              key={r}
              onClick={() => setRounding(r)}
              className={`px-1.5 py-0.5 rounded-sm transition ${
                rounding === r
                  ? 'bg-[#ffd333] text-black'
                  : 'text-[#848e9c] hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex text-[10px] text-[#848e9c] px-3 py-1.5 border-b border-[#1e2433] font-semibold bg-[#0d111b]">
        <span className="flex-1">Price(INR)</span>
        <span className="w-20 text-right">Amount({base})</span>
        <span className="w-20 text-right">Total</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col justify-end">
        {asksWithCumulative.map((ask, i) => {
          const depthPct = (ask.amount / maxAmount) * 100;
          const isFlash = flashRow === ask.price + 'SELL';
          return (
            <div
              key={`ask-${i}`}
              className={`flex text-[11px] px-3 py-1 hover:bg-[#1e2433] relative transition cursor-pointer ${
                isFlash ? 'bg-[#f6465d]/20' : ''
              }`}
              style={{
                background: isFlash
                  ? 'rgba(246, 70, 93, 0.2)'
                  : `linear-gradient(to left, rgba(246, 70, 93, 0.08) ${depthPct}%, transparent ${depthPct}%)`
              }}
              onMouseEnter={() => handleMouseEnter(ask, 'SELL')}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleRowClick(ask, 'SELL')}
            >
              <span className="flex-1 text-[#f6465d] font-semibold">{formatINR(ask.price)}</span>
              <span className="w-20 text-right text-white font-medium">{formatAmount(ask.amount)}</span>
              <span className="w-20 text-right text-[#848e9c]">{formatINR(ask.total)}</span>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-y border-[#1e2433] flex items-center justify-center bg-[#0d111b] gap-2">
        <span className="text-sm font-bold text-[#0ecb81] tracking-wide flex items-center gap-1">
          <svg className="w-3.5 h-3.5 fill-current text-[#0ecb81]" viewBox="0 0 24 24">
            <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
          </svg>
          {formatINR(currentPriceINR)}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {bidsWithCumulative.map((bid, i) => {
          const depthPct = (bid.amount / maxAmount) * 100;
          const isFlash = flashRow === bid.price + 'BUY';
          return (
            <div
              key={`bid-${i}`}
              className={`flex text-[11px] px-3 py-1 hover:bg-[#1e2433] relative transition cursor-pointer ${
                isFlash ? 'bg-[#0ecb81]/20' : ''
              }`}
              style={{
                background: isFlash
                  ? 'rgba(14, 203, 129, 0.2)'
                  : `linear-gradient(to left, rgba(14, 203, 129, 0.08) ${depthPct}%, transparent ${depthPct}%)`
              }}
              onMouseEnter={() => handleMouseEnter(bid, 'BUY')}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleRowClick(bid, 'BUY')}
            >
              <span className="flex-1 text-[#0ecb81] font-semibold">{formatINR(bid.price)}</span>
              <span className="w-20 text-right text-white font-medium">{formatAmount(bid.amount)}</span>
              <span className="w-20 text-right text-[#848e9c]">{formatINR(bid.total)}</span>
            </div>
          );
        })}
      </div>

      {tooltip && hoveredRow && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 mr-2 z-50 bg-[#1e2433] border border-[#2b3548] rounded-lg px-3 py-2 shadow-xl text-[11px] min-w-[140px]">
          <div className="text-[#848e9c] text-[10px] mb-1 font-semibold">Cumulative Stats</div>
          <div className="flex justify-between text-white mb-0.5">
            <span className="text-[#848e9c]">Avg Price:</span>
            <span className="font-bold text-right">{formatINR(tooltip.avg_price)}</span>
          </div>
          <div className="flex justify-between text-white mb-0.5">
            <span className="text-[#848e9c]">Sum {base}:</span>
            <span className="font-bold text-right">{formatAmount(tooltip.sum_coin)}</span>
          </div>
          <div className="flex justify-between text-white">
            <span className="text-[#848e9c]">Sum INR:</span>
            <span className="font-bold text-right">{formatINR(tooltip.sum_inr)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
