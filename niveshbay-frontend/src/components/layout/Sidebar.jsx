import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMarketData } from '../../hooks/useMarketData';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { formatINR, formatAmount } from '../../utils/formatCurrency';
import api from '../../api/axiosInstance';

export default function Sidebar({ symbol: propSymbol }) {
  const params = useParams();
  const activeSymbol = propSymbol || params.symbol || 'SOL-INR';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coins, activeCoin } = useMarketData(activeSymbol);
  const { tradeUpdates } = useSocket() || {};

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [tradeTab, setTradeTab] = useState('market');
  const [myTrades, setMyTrades] = useState([]);
  const [moverTab, setMoverTab] = useState('all');

  const base = activeSymbol?.split('-')[0] || 'SOL';

  // Normalize active symbol comparison
  const normalizedActiveSymbol = activeSymbol.replace(/[_/]/g, '-');

  // Filter coins list
  const filteredCoins = useMemo(() => {
    let list = coins;
    if (search) {
      list = list.filter(c =>
        c.market_symbol?.toLowerCase().includes(search.toLowerCase()) ||
        c.name?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (filter === 'gainers') {
      list = list.filter(c => parseFloat(c.change_24h || 0) > 0);
    } else if (filter === 'losers') {
      list = list.filter(c => parseFloat(c.change_24h || 0) < 0);
    }
    return list;
  }, [coins, search, filter]);

  // Generate mock market trades centered around active price
  const marketTrades = useMemo(() => {
    if (tradeUpdates && tradeUpdates.length > 0) return tradeUpdates;
    
    const activePriceUSD = activeCoin?.price || 69.18;
    const activePriceINR = activePriceUSD * 83;

    return Array.from({ length: 15 }, (_, i) => {
      const price = activePriceINR + (Math.random() - 0.5) * (activePriceINR * 0.003);
      const amount = Math.random() * (activePriceUSD > 1000 ? 0.05 : 5.0) + 0.01;
      const isBuy = Math.random() > 0.45;
      const now = new Date();
      now.setSeconds(now.getSeconds() - i * 5);
      return {
        price,
        amount,
        side: isBuy ? 'buy' : 'sell',
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    });
  }, [tradeUpdates, activeCoin, activeSymbol]);

  // Fetch User Trades (My Trades)
  useEffect(() => {
    async function fetchMyTrades() {
      if (!user) return;
      try {
        const dbSymbol = activeSymbol.replace('-', '_');
        const res = await api.get(`/user_completed_order_history?market_symbol=${dbSymbol}&user_id=${user.user_id}`);
        setMyTrades(res.data || []);
      } catch (err) {
        console.error('Failed to fetch user trades', err);
      }
    }
    if (tradeTab === 'my') {
      fetchMyTrades();
    }
  }, [tradeTab, activeSymbol, user]);

  // Top Movers data matching screenshots
  const topMovers = [
    { symbol: 'BTC/INR', priceINR: 5380218.77, change: 5.82 },
    { symbol: 'XRP/INR', priceINR: 48.47, change: -3.45 },
    { symbol: 'SOL/INR', priceINR: 5741.94, change: 8.21 },
    { symbol: 'DOGE/INR', priceINR: 12.04, change: -2.18 },
    { symbol: 'ADA/INR', priceINR: 40.26, change: -1.05 }
  ];

  return (
    <div className="w-[320px] bg-[#141822] border-l border-[#1e2433] flex flex-col shrink-0 select-none h-full overflow-y-auto custom-scrollbar">
      {/* 1. Coin Search & Tabs */}
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

      {/* Coin Filter Tabs */}
      <div className="flex border-b border-[#1e2433] text-[11px] font-bold bg-[#0d111b]">
        {[
          { key: 'all', label: 'All' },
          { key: 'gainers', label: 'Gainers' },
          { key: 'losers', label: 'Losers' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-2 text-center relative transition ${
              filter === tab.key ? 'text-[#ffd333]' : 'text-[#848e9c] hover:text-white'
            }`}
          >
            {tab.label}
            {filter === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffd333]" />
            )}
          </button>
        ))}
      </div>

      {/* Coin List Column Headings */}
      <div className="flex text-[10px] text-[#848e9c] px-3 py-1.5 border-b border-[#1e2433] font-semibold bg-[#0d111b]">
        <span className="flex-1">Name</span>
        <span className="w-28 text-right">Last Price / 24h Chg %</span>
      </div>

      {/* Coin List Scroll Container */}
      <div className="max-h-[250px] overflow-y-auto border-b border-[#1e2433] bg-[#141822]">
        {filteredCoins.map(coin => {
          const coinSymbol = coin.market_symbol.replace(/[_]/g, '-');
          const isSelected = normalizedActiveSymbol === coinSymbol;
          const change = parseFloat(coin.change_24h || 0);
          const isPositive = change >= 0;
          const priceINR = coin.price * 83;

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
                  <span className="text-white font-bold">{coinSymbol.split('-')[0]}</span>
                  <span className="text-[#848e9c] text-[10px]">/{coinSymbol.split('-')[1]}</span>
                </div>
                <span className="text-[#848e9c] text-[9px] mt-0.5 capitalize">{coin.name}</span>
              </div>
              <div className="w-28 text-right leading-none">
                <p className="text-white font-bold">{formatINR(priceINR)}</p>
                <p className={`text-[10px] font-semibold mt-1 ${isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(2)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Market Trades & My Trades Panel */}
      <div className="flex border-b border-[#1e2433] text-[11px] font-bold bg-[#0d111b] mt-2">
        <button
          onClick={() => setTradeTab('market')}
          className={`flex-1 py-2 text-center relative transition ${
            tradeTab === 'market' ? 'text-[#ffd333]' : 'text-[#848e9c] hover:text-white'
          }`}
        >
          Market Trades
          {tradeTab === 'market' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffd333]" />}
        </button>
        <button
          onClick={() => setTradeTab('my')}
          className={`flex-1 py-2 text-center relative transition ${
            tradeTab === 'my' ? 'text-[#ffd333]' : 'text-[#848e9c] hover:text-white'
          }`}
        >
          My Trades
          {tradeTab === 'my' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffd333]" />}
        </button>
      </div>

      <div className="flex text-[9px] text-[#848e9c] px-3 py-1.5 border-b border-[#1e2433] font-semibold bg-[#0d111b]">
        <span className="flex-1">Price(INR)</span>
        <span className="w-20 text-right">Amount({base})</span>
        <span className="w-20 text-right">Time</span>
      </div>

      {/* Trades List Container */}
      <div className="max-h-[180px] overflow-y-auto border-b border-[#1e2433] bg-[#141822]">
        {tradeTab === 'market' ? (
          marketTrades.map((t, i) => (
            <div key={`m-trade-${i}`} className="flex text-[10px] px-3 py-1 hover:bg-[#1e2433]/30">
              <span className={`flex-1 font-semibold ${t.side === 'buy' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {formatINR(t.price)}
              </span>
              <span className="w-20 text-right text-white font-medium">{formatAmount(t.amount)}</span>
              <span className="w-20 text-right text-[#848e9c] font-medium">{t.time}</span>
            </div>
          ))
        ) : myTrades.length === 0 ? (
          <div className="py-8 text-center text-[#848e9c] text-xs">No trades yet</div>
        ) : (
          myTrades.map((t, i) => (
            <div key={`my-trade-${i}`} className="flex text-[10px] px-3 py-1 hover:bg-[#1e2433]/30">
              <span className={`flex-1 font-semibold ${t.bid_type === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {formatINR((t.bid_price || t.price) * 83)}
              </span>
              <span className="w-20 text-right text-white font-medium">{formatAmount(t.bid_qty || t.volume)}</span>
              <span className="w-20 text-right text-[#848e9c] font-medium">
                {new Date(t.open_order || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>

      {/* 3. Top Movers Panel */}
      <div className="p-3 bg-[#0d111b] mt-2">
        <h4 className="text-xs text-[#848e9c] font-bold uppercase tracking-wider mb-2">Top Movers</h4>
        
        {/* Movers Tabs */}
        <div className="flex gap-2 text-[9px] font-bold text-[#848e9c] mb-2 border-b border-[#1e2433] pb-1">
          {['All', 'Change', 'New High/Low', 'Volume'].map(tab => (
            <button
              key={tab}
              onClick={() => setMoverTab(tab.toLowerCase())}
              className={`hover:text-white transition ${
                moverTab === tab.toLowerCase() ? 'text-[#ffd333]' : ''
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Movers List */}
        <div className="space-y-2">
          {topMovers.map(coin => {
            const isPositive = coin.change >= 0;
            const priceINR = coin.priceINR;
            return (
              <div
                key={coin.symbol}
                onClick={() => navigate(`/trade/${coin.symbol.replace('/', '-')}`)}
                className="flex items-center justify-between py-1 cursor-pointer hover:bg-[#1e2433] px-2 rounded border border-[#1e2433]/50 transition"
              >
                <div className="flex flex-col leading-none">
                  <div className="flex items-center gap-0.5">
                    <span className="text-white font-bold text-xs">{coin.symbol.split('/')[0]}</span>
                    <span className="text-[#848e9c] text-[9px]">/INR</span>
                  </div>
                  <span className="text-[9px] text-[#848e9c] mt-0.5">{formatINR(coin.priceINR)}</span>
                </div>
                
                {/* Custom Pill Badge (Green for positive, red for negative) */}
                <div className={`px-2.5 py-1 rounded text-xs font-bold shrink-0 text-center min-w-[70px] ${
                  isPositive 
                    ? 'bg-[#00c076] text-black shadow-[0_0_10px_rgba(0,192,118,0.2)]' 
                    : 'bg-[#f6465d] text-white shadow-[0_0_10px_rgba(246,70,93,0.2)]'
                }`}>
                  {isPositive ? '+' : ''}{coin.change.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

