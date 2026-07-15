import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useMarketData } from '../hooks/useMarketData';
import { useSocket } from '../context/SocketContext';
import { formatINR } from '../utils/formatCurrency';
import api from '../api/axiosInstance';

const fetcher = (url) => api.get(url).then(r => r.data);

const TABS = [
  { key: 'markets', label: 'Markets' },
  { key: 'pairs', label: 'Coin Pairs' },
  { key: 'currencies', label: 'Currencies' },
];

const FILTERS = ['All', 'Gainers', 'Losers'];

function CoinAvatar({ symbol, size = 'w-7 h-7' }) {
  const letter = (symbol || '?')[0].toUpperCase();
  return (
    <div className={`${size} rounded-full bg-[#f0b90b]/20 flex items-center justify-center text-xs font-bold text-[#f0b90b] shrink-0`}>
      {letter}
    </div>
  );
}

function SkeletonRows({ count = 8 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-full bg-[#1e2433] animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-[#1e2433] rounded animate-pulse w-24" />
            <div className="h-2.5 bg-[#1e2433] rounded animate-pulse w-16" />
          </div>
          <div className="h-3 bg-[#1e2433] rounded animate-pulse w-20" />
          <div className="h-3 bg-[#1e2433] rounded animate-pulse w-16" />
          <div className="h-3 bg-[#1e2433] rounded animate-pulse w-20" />
        </div>
      ))}
    </div>
  );
}

export default function MarketsPage() {
  const navigate = useNavigate();
  const { coins: marketCoins, isLoading: marketsLoading } = useMarketData(null);
  const { prices } = useSocket() || {};

  const [activeTab, setActiveTab] = useState('markets');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const { data: rawPairs, isLoading: pairsLoading } = useSWR(
    activeTab === 'pairs' ? '/markets' : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: currencies, isLoading: currenciesLoading } = useSWR(
    activeTab === 'currencies' ? '/currency_symbols' : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const liveCoins = useMemo(() => {
    return marketCoins.map(coin => {
      const live = prices?.[coin.market_symbol];
      if (!live) return coin;
      return {
        ...coin,
        price: live.last_price !== undefined ? live.last_price : coin.price,
        change_24h: live.price_change_24h !== undefined ? live.price_change_24h : coin.change_24h,
        volume_24h: live.volume_24h !== undefined ? live.volume_24h : coin.volume_24h,
        high_24h: live.price_high_24h !== undefined ? live.price_high_24h : coin.high_24h,
        low_24h: live.price_low_24h !== undefined ? live.price_low_24h : coin.low_24h,
      };
    });
  }, [marketCoins, prices]);

  const searchFiltered = useMemo(() => {
    if (!search.trim()) return liveCoins;
    const q = search.toLowerCase();
    return liveCoins.filter(c =>
      c.market_symbol?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q)
    );
  }, [liveCoins, search]);

  const gainerFiltered = useMemo(() => {
    if (filter === 'Gainers') return searchFiltered.filter(c => parseFloat(c.change_24h || 0) > 0);
    if (filter === 'Losers') return searchFiltered.filter(c => parseFloat(c.change_24h || 0) < 0);
    return searchFiltered;
  }, [searchFiltered, filter]);

  const pairsFiltered = useMemo(() => {
    if (!rawPairs) return [];
    const list = Array.isArray(rawPairs) ? rawPairs : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(p =>
      p.market_symbol?.toLowerCase().includes(q) ||
      p.currency_symbol?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q)
    );
  }, [rawPairs, search]);

  const currenciesFiltered = useMemo(() => {
    if (!currencies) return [];
    const list = Array.isArray(currencies) ? currencies : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      c.symbol?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.coin_name?.toLowerCase().includes(q) ||
      c.full_name?.toLowerCase().includes(q)
    );
  }, [currencies, search]);

  const loadingMarkets = marketsLoading && marketCoins.length === 0;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-[#848e9c] hover:text-white text-xs font-semibold mb-4 transition cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h1 className="text-xl font-bold text-white">Market Data</h1>
        <p className="text-xs text-[#848e9c] mt-0.5 mb-5">Live from NiveshBay backend</p>

        <div className="flex gap-1 bg-[#141822] rounded-lg p-1 border border-[#1e2433] w-fit mb-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-[#f0b90b] text-black'
                  : 'text-[#848e9c] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex items-center bg-[#141822] border border-[#2b3548] rounded px-3 py-1.5 flex-1 max-w-sm focus-within:border-[#f0b90b] transition">
            <svg className="w-4 h-4 text-[#848e9c] mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search markets..."
              className="w-full bg-transparent text-xs text-white placeholder-[#848e9c] focus:outline-none"
            />
          </div>

          {activeTab === 'markets' && (
            <div className="flex gap-1.5 items-center">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition cursor-pointer ${
                    filter === f
                      ? 'bg-[#f0b90b] text-black'
                      : 'bg-[#141822] text-[#848e9c] hover:text-white border border-[#1e2433]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'markets' && (
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 text-xs text-[#848e9c] px-4 py-2.5 border-b border-[#1e2433] font-semibold uppercase tracking-wider">
              <span className="col-span-4">Name</span>
              <span className="col-span-3 text-right">Price (USDT)</span>
              <span className="col-span-2 text-right">24H %</span>
              <span className="col-span-3 text-right">Volume</span>
            </div>

            {loadingMarkets ? (
              <SkeletonRows />
            ) : gainerFiltered.length === 0 ? (
              <div className="py-10 text-center text-[#848e9c] text-xs">No markets found.</div>
            ) : (
              gainerFiltered.map(coin => {
                const change = parseFloat(coin.change_24h || 0);
                const [base] = (coin.market_symbol || '').split('-');
                return (
                  <div
                    key={coin.market_symbol}
                    onClick={() => navigate(`/trade/${coin.market_symbol}`)}
                    className="grid grid-cols-12 text-sm px-4 py-3 hover:bg-[#1e2329] cursor-pointer border-b border-[#1e2433]/50 last:border-0 items-center"
                  >
                    <div className="col-span-4 flex items-center gap-2.5">
                      <CoinAvatar symbol={base} />
                      <div>
                        <span className="text-white font-medium text-sm">{coin.market_symbol}</span>
                        {coin.name && (
                          <p className="text-[#848e9c] text-[11px] leading-tight">{coin.name}</p>
                        )}
                      </div>
                    </div>
                    <span className="col-span-3 text-right text-white font-medium tabular-nums">
                      {formatINR(coin.price || 0)}
                    </span>
                    <span className={`col-span-2 text-right font-medium tabular-nums ${
                      change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                    <span className="col-span-3 text-right text-[#848e9c] text-xs tabular-nums">
                      {parseFloat(coin.volume_24h || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'pairs' && (
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 text-xs text-[#848e9c] px-4 py-2.5 border-b border-[#1e2433] font-semibold uppercase tracking-wider">
              <span className="col-span-3">Market Symbol</span>
              <span className="col-span-2">Currency</span>
              <span className="col-span-3">Name</span>
              <span className="col-span-2 text-right">Initial Price</span>
              <span className="col-span-2 text-right">Status</span>
            </div>

            {pairsLoading ? (
              <SkeletonRows />
            ) : pairsFiltered.length === 0 ? (
              <div className="py-10 text-center text-[#848e9c] text-xs">No coin pairs found.</div>
            ) : (
              pairsFiltered.map((pair, i) => (
                <div
                  key={pair.id || i}
                  className="grid grid-cols-12 text-sm px-4 py-3 hover:bg-[#1e2329] border-b border-[#1e2433]/50 last:border-0 items-center"
                >
                  <div className="col-span-3 flex items-center gap-2">
                    <CoinAvatar symbol={pair.currency_symbol} />
                    <span className="text-white font-medium text-sm">{pair.market_symbol}</span>
                  </div>
                  <span className="col-span-2 text-[#848e9c] text-xs">{pair.currency_symbol}</span>
                  <span className="col-span-3 text-[#848e9c] text-xs">{pair.name || '-'}</span>
                  <span className="col-span-2 text-right text-white text-xs tabular-nums">
                    {pair.initial_price ? formatINR(pair.initial_price) : '-'}
                  </span>
                  <span className={`col-span-2 text-right text-xs font-medium ${
                    pair.status === 1 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                  }`}>
                    {pair.status === 1 ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'currencies' && (
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 text-xs text-[#848e9c] px-4 py-2.5 border-b border-[#1e2433] font-semibold uppercase tracking-wider">
              <span className="col-span-3">Symbol</span>
              <span className="col-span-4">Name</span>
              <span className="col-span-3">Type</span>
              <span className="col-span-2 text-right">Status</span>
            </div>

            {currenciesLoading ? (
              <SkeletonRows />
            ) : currenciesFiltered.length === 0 ? (
              <div className="py-10 text-center text-[#848e9c] text-xs">No currencies found.</div>
            ) : (
              currenciesFiltered.map((c, i) => (
                <div
                  key={c.id || i}
                  className="grid grid-cols-12 text-sm px-4 py-3 hover:bg-[#1e2329] border-b border-[#1e2433]/50 last:border-0 items-center"
                >
                  <div className="col-span-3 flex items-center gap-2">
                    <CoinAvatar symbol={c.symbol} />
                    <span className="text-white font-medium text-sm">{c.symbol}</span>
                  </div>
                  <span className="col-span-4 text-[#848e9c] text-xs">{c.name || c.coin_name || c.full_name || '-'}</span>
                  <span className="col-span-3 text-[#848e9c] text-xs">{c.crypto_type || '-'}</span>
                  <span className={`col-span-2 text-right text-xs font-medium ${
                    c.status === 1 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                  }`}>
                    {c.status === 1 ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
