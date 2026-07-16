import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMarketData } from '../../hooks/useMarketData';
import { formatCurrency } from '../../utils/formatCurrency';

export default function Sidebar({ symbol: propSymbol }) {
  const params = useParams();
  const activeSymbol = propSymbol || params.symbol || 'SOL-USDT';
  const navigate = useNavigate();
  const { coins, activeCoin } = useMarketData(activeSymbol);

  const [search, setSearch] = useState('');

  const normalizedActiveSymbol = activeSymbol.replace(/[_/]/g, '-');

  const filteredCoins = useMemo(() => {
    let list = coins;
    if (search) {
      list = list.filter(c =>
        c.market_symbol?.toLowerCase().includes(search.toLowerCase()) ||
        c.name?.toLowerCase().includes(search.toLowerCase())
      );
    }
    return list;
  }, [coins, search]);

  return (
    <div className="w-[320px] bg-[#141822] border-l border-[#1e2433] flex flex-col shrink-0 select-none h-full">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
      {/* Nav Links */}
      <div className="flex border-b border-[#1e2433] text-[11px] font-bold bg-[#0d111b]">
        <span className="flex-1 py-2 text-center text-[#ffd333] border-b-2 border-[#ffd333]">
          Trade
        </span>
      </div>
      {/* Coin Search */}
      <div className="p-3 border-b border-[#1e2433] bg-[#0d111b]">
        <div className="relative flex items-center bg-[#1e2433] border border-[#2b3548] rounded px-3 py-1.5 focus-within:border-[#ffd333] transition">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search coins..."
            className="w-full bg-transparent text-xs text-white placeholder-[#848e9c] focus:outline-none"
          />
          <svg className="w-4 h-4 text-[#848e9c] ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Coin List Column Headings */}
      <div className="flex text-[10px] text-[#848e9c] px-3 py-1.5 border-b border-[#1e2433] font-semibold bg-[#0d111b]">
        <span className="flex-1">Name</span>
        <span className="w-28 text-right">Last Price / 24h Chg %</span>
      </div>

      {/* Coin List */}
      <div className="border-b border-[#1e2433] bg-[#141822]">
        {filteredCoins.map(coin => {
          const coinSymbol = coin.market_symbol.replace(/[_]/g, '-');
          const isSelected = normalizedActiveSymbol === coinSymbol;
          const change = parseFloat(coin.change_24h || 0);
          const isPositive = change >= 0;
          const [coinBase, coinQuote] = coinSymbol.split('-');
          const coinPrice = coin.price;

          return (
            <div
              key={coin.id || coin.market_symbol}
              onClick={() => navigate(`/trade/${coinSymbol}`)}
              className={`flex items-center px-3 py-2 cursor-pointer hover:bg-[#1e2433]/70 text-xs transition border-b border-[#1e2433]/30 ${
                isSelected ? 'bg-[#1e2433] border-l-2 border-[#ffd333]' : ''
              }`}
            >
              <div className="flex flex-col flex-1 leading-none">
                <div className="flex items-center gap-1">
                  <span className="text-white font-bold">{coinBase}</span>
                  <span className="text-[#848e9c] text-[10px]">/{coinQuote}</span>
                </div>
                <span className="text-[#848e9c] text-[9px] mt-0.5 capitalize">{coin.name}</span>
              </div>
              <div className="w-28 text-right leading-none">
                <p className="text-white font-bold">{formatCurrency(coinPrice, coinQuote)}</p>
                <p className={`text-[10px] font-semibold mt-1 ${isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(2)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>

      </div>
    </div>
  );
}

