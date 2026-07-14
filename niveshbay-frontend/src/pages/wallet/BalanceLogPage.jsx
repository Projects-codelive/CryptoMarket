// pages/wallet/BalanceLogPage.jsx
// Route: /wallet/balance-log
//
// Complete ledger of all balance changes from dbt_balance_log.
// Reuses the existing GET /api/v1/wallet/history endpoint — no new backend needed.
//
// Note on balance_before / balance_after:
//   dbt_balance_log does NOT store these columns (confirmed via SHOW COLUMNS).
//   We display transaction_amount in a Credit or Debit column based on
//   transaction_type — this is the accurate representation of available data.

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBalanceStats } from '../../hooks/useBalanceStats';
import { usePaginatedFetch } from '../../hooks/usePaginatedFetch';
import { getBalanceLog, getCoinSymbols } from '../../api/tradeBalance';
import { formatAmount } from '../../utils/formatCurrency';
import Navbar from '../../components/layout/Navbar';
import {
  Breadcrumb, FilterInput, FilterSelect, RefreshButton,
  TableWrapper, Th, Td, TableLoading, TableEmpty, TableError, Pagination,
} from '../../components/common/TableShared';

const LIMIT = 30;

// ── Transaction type helpers ──────────────────────────────────────────────────

// Types that represent money coming IN (credit)
const CREDIT_TYPES = new Set([
  'DEPOSIT', 'ADMIN_BONUS', 'TRADE_BUY', 'STAKING_MATURITY',
  'WITHDRAW_REJECTED_REFUND', 'REFERRAL_BONUS', 'STAKING_UNSTAKE',
  'PRICE_IMPROVEMENT_REFUND', 'ORDER_CANCEL_REFUND', 'ADMIN_CREDIT',
  'TRANSFER_IN',
]);

function isCredit(type) {
  if (!type) return false;
  if (CREDIT_TYPES.has(type)) return true;
  if (type.startsWith('TRANSFER_IN')) return true;
  return false;
}

// Human-readable label for transaction type
function txLabel(type) {
  const map = {
    DEPOSIT:                    'Deposit',
    ADMIN_BONUS:                'Admin Bonus',
    ADMIN_CREDIT:               'Admin Credit',
    ADMIN_DEBIT:                'Admin Debit',
    TRADE_BUY:                  'Buy Trade',
    TRADE_SELL:                 'Sell Trade',
    ORDER_PLACE_BUY:            'Buy Order Placed',
    ORDER_PLACE_SELL:           'Sell Order Placed',
    ORDER_CANCEL_REFUND:        'Order Cancelled',
    PRICE_IMPROVEMENT_REFUND:   'Price Improvement',
    WITHDRAW_REQUEST:           'Withdrawal',
    WITHDRAW_REJECTED_REFUND:   'Withdrawal Refund',
    STAKING_SUBSCRIBE:          'Staking',
    STAKING_MATURITY:           'Staking Reward',
    STAKING_UNSTAKE:            'Staking Unstake',
    REFERRAL_BONUS:             'Referral Reward',
    TRANSFER_IN:                'Transfer In',
    TRANSFER_OUT:               'Transfer Out',
    TRANSFER_SPOT_TO_FUNDING:   'Transfer → Funding',
    TRANSFER_FUNDING_TO_SPOT:   'Transfer ← Funding',
    TRANSFER_SPOT_TO_SHARE:     'Transfer → Share',
    TRANSFER_SHARE_TO_SPOT:     'Transfer ← Share',
    TRANSFER_FUNDING_TO_SHARE:  'Transfer Funding→Share',
    TRANSFER_SHARE_TO_FUNDING:  'Transfer Share→Funding',
  };
  return map[type] || type;
}

// Colour for credit/debit amount cell
function amountClass(credit) {
  return credit ? 'text-[#0ecb81]' : 'text-[#f6465d]';
}

function txTypeBadge(type) {
  const credit = isCredit(type);
  const isTransfer = type?.startsWith('TRANSFER_');
  let cls = 'bg-[#f6465d]/10 text-[#f6465d]';
  if (credit)     cls = 'bg-[#0ecb81]/10 text-[#0ecb81]';
  if (isTransfer) cls = 'bg-[#f0b90b]/10 text-[#f0b90b]';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {txLabel(type)}
    </span>
  );
}

// All known transaction type options for the filter dropdown
const TX_TYPE_OPTIONS = [
  { value: 'deposit',  label: 'Deposit'         },
  { value: 'withdraw', label: 'Withdrawal'       },
  { value: 'transfer', label: 'Transfer'         },
  { value: 'trade',    label: 'Trade'            },
  { value: 'staking',  label: 'Staking'          },
  { value: 'referral', label: 'Referral Reward'  },
  { value: 'others',   label: 'Others'           },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BalanceLogPage() {
  const { stats } = useBalanceStats();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [asset,   setAsset]   = useState('');
  const [txType,  setTxType]  = useState('');
  const [search,  setSearch]  = useState('');
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [sort,    setSort]    = useState('desc');
  const [page,    setPage]    = useState(0);

  const [coins, setCoins] = useState([]);

  // Load coin list for filter dropdown once
  useEffect(() => {
    getCoinSymbols()
      .then(data => setCoins(data.map(c => c.symbol || c.coin_symbol).filter(Boolean)))
      .catch(() => {});
  }, []);

  // Committed filter params
  const [committed, setCommitted] = useState({
    type: '', asset: '', from: '', to: '', sort: 'desc', limit: LIMIT, offset: 0,
  });

  function applyFilters() {
    setPage(0);
    setCommitted({ type: txType, asset, from, to, sort, limit: LIMIT, offset: 0 });
  }

  function resetFilters() {
    setAsset(''); setTxType(''); setSearch('');
    setFrom(''); setTo(''); setSort('desc');
    setPage(0);
    setCommitted({ type: '', asset: '', from: '', to: '', sort: 'desc', limit: LIMIT, offset: 0 });
  }

  const params = useMemo(() => ({ ...committed, offset: page * LIMIT }), [committed, page]);

  const { data: logs, total, loading, error, refresh } = usePaginatedFetch(getBalanceLog, params);

  // Client-side search by log_id / reference (no backend param for balance log)
  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.trim().toLowerCase();
    return logs.filter(l =>
      String(l.log_id).includes(q) ||
      (l.currency_symbol || '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const totalPages = Math.ceil(total / LIMIT);

  const inrBal         = stats?.inr_balance         || 0;
  const totalPortfolio  = stats?.total_portfolio_value || 0;
  const realizedPnl    = stats?.realized_pnl          || 0;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Navbar balance={inrBal} portfolioValue={totalPortfolio} realizedPnl={realizedPnl} />
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Breadcrumb */}
        <Breadcrumb items={[
          <Link to="/wallet/spot" className="hover:text-white transition">Wallet</Link>,
          'Balance Log',
        ]} />

        {/* Page header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Balance Log</h1>
            <p className="text-[#848e9c] text-xs mt-0.5">Complete ledger of all wallet balance changes</p>
          </div>
          <RefreshButton onClick={refresh} loading={loading} />
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">

            {/* Search by Ref ID */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">Reference ID</label>
              <FilterInput
                value={search} onChange={setSearch}
                placeholder="Search log ID" className="w-32"
              />
            </div>

            {/* Coin */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">Coin</label>
              <FilterSelect value={asset} onChange={setAsset} className="w-28">
                <option value="">All Coins</option>
                {coins.map(c => <option key={c} value={c}>{c}</option>)}
              </FilterSelect>
            </div>

            {/* Transaction Type */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#848e9c] uppercase font-semibold">Type</label>
              <FilterSelect value={txType} onChange={setTxType} className="w-36">
                <option value="">All Types</option>
                {TX_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
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
              <Th>Date & Time</Th>
              <Th>Coin</Th>
              <Th>Transaction Type</Th>
              <Th right>Credit</Th>
              <Th right>Debit</Th>
              <Th right>Fee</Th>
              <Th>Ref ID</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoading cols={7} />
            ) : error ? (
              <TableError cols={7} message={error} onRetry={refresh} />
            ) : filtered.length === 0 ? (
              <TableEmpty cols={7} message="No balance records found. Try adjusting your filters." />
            ) : filtered.map(log => {
              const credit = isCredit(log.transaction_type);
              const amount = parseFloat(log.transaction_amount || 0);
              const fee    = parseFloat(log.transaction_fees   || 0);
              return (
                <tr key={log.log_id}
                  className="border-b border-[#1e2433] hover:bg-[#1e2433]/50 transition">
                  <Td className="text-[#848e9c] whitespace-nowrap">
                    {new Date(log.date).toLocaleString()}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#1e2330] border border-[#2b3548] flex items-center justify-center text-[9px] font-bold text-[#f0b90b]">
                        {(log.currency_symbol || '?')[0]}
                      </div>
                      <span className="text-white font-semibold">{log.currency_symbol}</span>
                    </div>
                  </Td>
                  <Td>{txTypeBadge(log.transaction_type)}</Td>
                  <Td right>
                    {credit && amount > 0
                      ? <span className="text-[#0ecb81] font-mono font-semibold">+{formatAmount(amount)}</span>
                      : <span className="text-[#848e9c]">—</span>}
                  </Td>
                  <Td right>
                    {!credit && amount > 0
                      ? <span className="text-[#f6465d] font-mono font-semibold">-{formatAmount(amount)}</span>
                      : <span className="text-[#848e9c]">—</span>}
                  </Td>
                  <Td right>
                    {fee > 0
                      ? <span className="text-[#f0b90b] font-mono">{formatAmount(fee)}</span>
                      : <span className="text-[#848e9c]">—</span>}
                  </Td>
                  <Td className="text-[#848e9c] font-mono text-[10px]">#{log.log_id}</Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrapper>

        {/* Count */}
        {filtered.length > 0 && (
          <div className="mt-2 text-xs text-[#848e9c] text-right">
            Showing {filtered.length} of {total} records
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
