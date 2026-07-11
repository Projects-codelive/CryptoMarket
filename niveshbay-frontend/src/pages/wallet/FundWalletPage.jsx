// pages/wallet/FundWalletPage.jsx
// Route: /wallet/fund
//
// Displays the Funding Wallet balance from the existing wallet overview API.
// — No Deposit button
// — No Withdraw button
// — Transfer IS available (users can still move funds between wallets)
// — Reuses the same overview data, zero new API calls

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletOverview } from '../../hooks/useWalletOverview';
import { useBalanceStats } from '../../hooks/useBalanceStats';
import Navbar from '../../components/layout/Navbar';
import TransferModal from '../../components/wallet/TransferModal';
import WalletNav from '../../components/wallet/WalletNav';
import WalletSummaryCard from '../../components/wallet/WalletSummaryCard';
import WalletSearchBar from '../../components/wallet/WalletSearchBar';
import WalletTable from '../../components/wallet/WalletTable';

export default function FundWalletPage() {
  const navigate = useNavigate();
  const { overview, loading, error, refresh } = useWalletOverview();
  const { stats } = useBalanceStats();
  const [hideZero, setHideZero] = useState(false);
  const [search, setSearch] = useState('');
  const [showTransfer, setShowTransfer] = useState(null);

  // Total funding wallet value = sum of all coins' funding balances × price
  const fundingTotal = useMemo(
    () => overview.reduce((acc, c) => acc + (c.funding || 0) * (c.price || 0), 0),
    [overview]
  );

  const filtered = useMemo(() => {
    let list = overview;
    if (hideZero) list = list.filter((c) => c.funding > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.coin || '').toLowerCase().includes(q) ||
          (c.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [overview, hideZero, search]);

  const inrBal = stats?.inr_balance || 0;
  const totalPortfolio = stats?.total_portfolio_value || 0;
  const realizedPnl = stats?.realized_pnl || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Navbar balance={inrBal} portfolioValue={totalPortfolio} realizedPnl={realizedPnl} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Navbar balance={inrBal} portfolioValue={totalPortfolio} realizedPnl={realizedPnl} />
        <div className="flex items-center justify-center h-[80vh] text-[#f6465d] text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Navbar balance={inrBal} portfolioValue={totalPortfolio} realizedPnl={realizedPnl} />
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Back to Trade */}
        <button
          onClick={() => navigate('/trade/SOL-INR')}
          className="flex items-center gap-1 text-[#848e9c] hover:text-white text-xs mb-4 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Trade
        </button>

        {/* Wallet tab navigation */}
        <WalletNav />

        {/* Summary card — Fund Wallet has NO Deposit / Withdraw */}
        <WalletSummaryCard
          label="Estimated Total Value (Fund)"
          value={fundingTotal}
          showActions={false}
        />

        {/* Search & hide-zero filter (hides coins with zero funding balance) */}
        <WalletSearchBar
          search={search}
          onSearchChange={setSearch}
          hideZero={hideZero}
          onHideZeroChange={setHideZero}
        />

        {/* Coin table — Fund Wallet shows Transfer only */}
        <WalletTable
          coins={filtered}
          walletKey="funding"
          columnLabel="Funding"
          onTransfer={(c) => setShowTransfer(c)}
          onRowClick={() => {}}
        />
      </div>

      {showTransfer && (
        <TransferModal
          coin={showTransfer}
          onClose={() => setShowTransfer(null)}
          onSuccess={() => { setShowTransfer(null); refresh(); }}
        />
      )}
    </div>
  );
}