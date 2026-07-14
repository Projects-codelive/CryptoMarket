// pages/wallet/TradeHistoryPage.jsx
// Route: /wallet/trade-history
//
// Displays the logged-in user's complete trade history from dbt_biding_log.
// Uses the new GET /api/v1/trade-history endpoint with full filter + pagination.

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBalanceStats } from '../../hooks/useBalanceStats';
import { usePaginatedFetch } from '../../hooks/usePaginatedFetch';
import { getTradeHistory } from '../../api/tradeBalance';
import { formatAmount } from '../../utils/formatCurrency';
import Navbar from '../../components/layout/Navbar';
import {
  Breadcrumb, FilterInput, FilterSelect,
  RefreshButton, TableWrapper, Th, Td,
  TableLoading, TableEmpty, TableError, Pagination,
} from '../../components/common/TableShared';

const LIMIT = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sideBadge(type) {
  const isBuy = type === 'BUY';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
      isBuy ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'
    }`}>
      {type}
    </span>
  );
}

function statusBadge(status) {
  // dbt_biding_log status: 1 = completed
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0ecb81]/10 text-[#0ecb81]">
      Completed
    </span>
  );
}

function fmt(val) {
  return formatAmount(parseFloat(val || 0));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TradeHistoryPage() {
  const { stats } = useBalanceStats();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [pair,   setPair]   = useState('');
  const [side,   setSide]   = useState('');
  const [search, setSearch] = useState('');
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');
  const [sort,   setSort]   = useState('desc');
  const [page,   setPage]   = useState(0);

  // Committed filters (only update on Apply to avoid mid-type refetches)
  const [committed, setCommitted] = useState({
    market_symbol: '', bid_type: '', search: '', from: '', to: '',
    sort: 'desc', limit: LIMIT, offset: 0,
  });

  function applyFilters() {
    const next = {
      market_symbol: pair,
      bid_type:      side,
      search,
      from,
      to,
      sort,
      limit:  LIMIT,
      offset: 0,
    };
    setPage(0);
    setCommitted(next);
  }

  function resetFilters() {
    setPair(''); setSide(''); setSearch('');
    setFrom(''); setTo(''); setSort('desc');
    setPage(0);
    setCommitted({ market_symbol: '', bid_type: '', search: '', from: '', to: '', sort: 'desc', limit: LIMIT, offset: 0 });
  }

  // Sync page into committed params
  const params = useMemo(() => ({ ...committed, offset: page * LIMIT }), [committed, page]);

  // Pairs available in the response for dropdown
  // (backend returns them; fallback to empty)
  const [pairsFromApi, setPairsFromApi] = useState([]);
  // We pick them up via a side-effect-free approach: they come in the API
  // response but usePaginatedFetch only returns rows. We store pairs when
  // we get a fresh response by wrapping the fetch.
  const wrappedFetch = useMemo(() => async (p) => {
    const res = await getTradeHistory(p);
    if (res.pairs) setPairsFromApi(res.pairs);
    return res;
  }, []);

  const { data: tradesW, total: totalW, loading: loadingW, error: errorW, refresh: refreshW }
    = usePaginatedFetch(wrappedFetch, params);

  const totalPages = Math.ceil(totalW / LIMIT);

  const inrBal        = stats?.inr_balance        || 0;
  const totalPortfolio = stats?.total_portfolio_value || 0;
  const realizedPnl   = stats?.realized_pnl        || 0;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Navbar balance={inrBal} portfolioValue={totalPortfolio} realizedPnl={realizedPnl} />
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Breadcrumb */}
        <Breadcrumb items={[
          <Link to="/wallet/spot" className="hover:text-white transition">Wallet</Link>,
          'Trade History',
        ]} />

        {/* Page header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Trade History</h1>
            <p className="text-[#848e9c] text-xs mt-0.5">Complete record of all your executed trades</p>
          </div>
          <RefreshButton onClick={refreshW} loading={loadingW} />
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">

            {/* Search by Trade ID */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">Trade ID</label>
              <FilterInput
                value={search} onChange={setSearch}
                placeholder="Search Trade ID" className="w-32"
              />
            </div>

            {/* Trading Pair */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">Pair</label>
              <FilterSelect value={pair} onChange={setPair} className="w-36">
                <option value="">All Pairs</option>
                {pairsFromApi.map(p => (
                  <option key={p} value={p}>{p.replace('_', '/')}</option>
                ))}
              </FilterSelect>
            </div>

            {/* Buy / Sell */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">Side</label>
              <FilterSelect value={side} onChange={setSide} className="w-28">
                <option value="">All</option>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </FilterSelect>
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">From</label>
              <FilterInput type="date" value={from} onChange={setFrom} />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">To</label>
              <FilterInput type="date" value={to} onChange={setTo} />
            </div>

            {/* Sort */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">Sort</label>
              <FilterSelect value={sort} onChange={setSort} className="w-28">
                <option value="desc">Latest First</option>
                <option value="asc">Oldest First</option>
              </FilterSelect>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-auto">
              <button onClick={applyFilters}
                className="px-4 py-1.5 bg-[#f0b90b] text-black text-xs font-bold rounded hover:bg-[#f0b90b]/90 transition">
                Apply
              </button>
              <button onClick={resetFilters}
                className="px-4 py-1.5 text-xs text-[#848e9c] hover:text-white transition">
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <TableWrapper>
          <thead>
            <tr className="border-b border-[#2b2f36]">
              <Th>Trade ID</Th>
              <Th>Date & Time</Th>
              <Th>Pair</Th>
              <Th>Side</Th>
              <Th right>Price</Th>
              <Th right>Quantity</Th>
              <Th right>Total</Th>
              <Th right>Fee</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {loadingW ? (
              <TableLoading cols={9} />
            ) : errorW ? (
              <TableError cols={9} message={errorW} onRetry={refreshW} />
            ) : tradesW.length === 0 ? (
              <TableEmpty cols={9} message="No trades found. Try adjusting your filters." />
            ) : tradesW.map(t => (
              <tr key={t.log_id}
                className="border-b border-[#1e2433] hover:bg-[#1e2433]/50 transition">
                <Td className="text-[#848e9c] font-mono">#{t.log_id}</Td>
                <Td className="text-[#848e9c] whitespace-nowrap">
                  {new Date(t.success_time).toLocaleString()}
                </Td>
                <Td>
                  <span className="font-semibold text-white">
                    {(t.market_symbol || '').replace('_', '/')}
                  </span>
                </Td>
                <Td>{sideBadge(t.bid_type)}</Td>
                <Td right className="text-white font-mono">{fmt(t.bid_price)}</Td>
                <Td right className="font-mono">{fmt(t.complete_qty)}</Td>
                <Td right className="font-mono text-white font-semibold">{fmt(t.complete_amount)}</Td>
                <Td right className="text-[#f0b90b] font-mono">{fmt(t.fees_amount)}</Td>
                <Td>{statusBadge(t.status)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>

        {/* Summary row */}
        {tradesW.length > 0 && (
          <div className="mt-2 text-xs text-[#848e9c] text-right">
            Showing {tradesW.length} of {totalW} trades
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage(p => Math.max(0, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages - 1, p + 1))}
        />
      </div>
    </div>
  );
}
