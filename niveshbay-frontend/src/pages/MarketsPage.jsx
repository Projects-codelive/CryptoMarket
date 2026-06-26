import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketData } from '../hooks/useMarketData';
import { formatINR } from '../utils/formatCurrency';

export default function MarketsPage() {
  const navigate = useNavigate();
  const { coins } = useMarketData(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('changePct');

  const filtered = coins.filter(c => {
    if (filter === 'gainers') return parseFloat(c.change_24h || 0) > 0;
    if (filter === 'losers') return parseFloat(c.change_24h || 0) < 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0b0e11]">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-[#848e9c] hover:text-white text-sm mb-4">← Back</button>
        <h1 className="text-2xl font-bold text-white mb-2">Crypto Markets</h1>

        <div className="flex gap-2 mb-4">
          {['all', 'gainers', 'losers'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full ${filter === f ? 'bg-[#f0b90b] text-black' : 'bg-[#161a1e] text-[#848e9c] hover:text-white'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="bg-[#161a1e] rounded-xl border border-[#2b2f36] overflow-hidden">
          <div className="grid grid-cols-5 text-xs text-[#848e9c] px-4 py-2 border-b border-[#2b2f36] font-medium">
            <span className="col-span-2">Name</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h Change</span>
            <span className="text-right">Volume</span>
          </div>
          {filtered.map(coin => {
            const change = parseFloat(coin.change_24h || 0);
            return (
              <div key={coin.id || coin.market_symbol}
                onClick={() => navigate(`/trade/${coin.market_symbol}`)}
                className="grid grid-cols-5 text-sm px-4 py-3 hover:bg-[#1e2329] cursor-pointer border-b border-[#2b2f36] last:border-0">
                <span className="col-span-2 text-white font-medium">{coin.market_symbol || coin.symbol}</span>
                <span className="text-right text-white">{formatINR(coin.price || 0)}</span>
                <span className={`text-right ${change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </span>
                <span className="text-right text-[#848e9c]">{parseFloat(coin.volume_24h || 0).toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
