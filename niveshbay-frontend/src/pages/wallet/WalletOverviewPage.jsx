import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWalletOverview } from '../../hooks/useWalletOverview';
import { useBalanceStats } from '../../hooks/useBalanceStats';
import { formatAmount } from '../../utils/formatCurrency';
import Navbar from '../../components/layout/Navbar';
import TransferModal from '../../components/wallet/TransferModal';

export default function WalletOverviewPage() {
  const navigate = useNavigate();
  const { overview, loading, error, refresh } = useWalletOverview();
  const { stats } = useBalanceStats();
  const [hideZero, setHideZero] = useState(false);
  const [search, setSearch] = useState('');
  const [showTransfer, setShowTransfer] = useState(null);

  const filtered = useMemo(() => {
    let list = overview;
    if (hideZero) list = list.filter(c => c.total > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => (c.coin || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [overview, hideZero, search]);

  const inrBal = stats?.inr_balance || 0;
  const totalPortfolio = stats?.total_portfolio_value || 0;
  const realizedPnl = stats?.realized_pnl || 0;
  const totalValue = totalPortfolio;

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
        <div className="flex items-center justify-center h-[80vh] text-[#f6465d] text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Navbar balance={inrBal} portfolioValue={totalPortfolio} realizedPnl={realizedPnl} />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back to Trade */}
        <button onClick={() => navigate('/trade/SOL-USDT')} className="flex items-center gap-1 text-[#848e9c] hover:text-white text-xs mb-4 transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to Trade
        </button>
        {/* Est. Total Value Card */}
        <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[#848e9c] text-xs uppercase tracking-wider">Estimated Total Value</span>
              <div className="text-2xl font-bold mt-1">
                <span className="text-white font-bold mr-1">$</span>
                {totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate('/wallet/deposit/USDT')} className="px-4 py-2 bg-[#0ecb81] text-black text-xs font-semibold rounded hover:bg-[#0ecb81]/90 transition">Deposit</button>
              <button onClick={() => navigate('/wallet/withdraw/USDT')} className="px-4 py-2 bg-[#f6465d] text-white text-xs font-semibold rounded hover:bg-[#f6465d]/90 transition">Withdraw</button>
              <button onClick={() => navigate('/wallet/history')} className="px-4 py-2 border border-[#2b3548] text-[#848e9c] text-xs font-semibold rounded hover:text-white transition">History</button>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search coins..."
            className="bg-[#141822] border border-[#2b3548] rounded px-3 py-2 text-xs text-white placeholder-[#848e9c] focus:outline-none focus:border-[#f0b90b] w-64"
          />
          <label className="flex items-center gap-2 text-xs text-[#848e9c] cursor-pointer">
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="accent-[#f0b90b]" />
            Hide zero balance
          </label>
        </div>

        {/* Coin Table */}
        <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2b2f36] text-[#848e9c] text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">Coin</th>
                <th className="text-right px-4 py-3 font-medium">Spot</th>
                <th className="text-right px-4 py-3 font-medium">Funding</th>
                <th className="text-right px-4 py-3 font-medium">Share</th>
                <th className="text-right px-4 py-3 font-medium">In Trade</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.coin || c.name || Math.random()} className="border-b border-[#1e2433] hover:bg-[#1e2433]/50 transition cursor-pointer" onClick={() => c.coin && navigate(`/wallet/deposit/${c.coin}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#1e2330] border border-[#2b3548] flex items-center justify-center text-xs font-bold text-[#f0b90b]">
                        {c.coin?.[0] || '?'}
                      </div>
                      <div>
                        <p className="text-white text-xs font-semibold">{c.coin || '???'}</p>
                        <p className="text-[#848e9c] text-[10px]">{c.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 text-xs">{formatAmount(c.spot)}</td>
                  <td className="text-right px-4 py-3 text-xs">{formatAmount(c.funding)}</td>
                  <td className="text-right px-4 py-3 text-xs">{formatAmount(c.share)}</td>
                  <td className="text-right px-4 py-3 text-xs text-[#f0b90b]">{formatAmount(c.inTrade)}</td>
                  <td className="text-right px-4 py-3 text-xs font-semibold">{formatAmount(c.total)}</td>
                  <td className="text-right px-4 py-3">
                    <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <button onClick={() => navigate(`/wallet/deposit/${c.coin}`)} className="px-2 py-1 text-[10px] bg-[#0ecb81]/10 text-[#0ecb81] rounded hover:bg-[#0ecb81]/20 transition">Deposit</button>
                      <button onClick={() => navigate(`/wallet/withdraw/${c.coin}`)} className="px-2 py-1 text-[10px] bg-[#f6465d]/10 text-[#f6465d] rounded hover:bg-[#f6465d]/20 transition">Withdraw</button>
                      <button onClick={() => setShowTransfer(c)} className="px-2 py-1 text-[10px] bg-[#f0b90b]/10 text-[#f0b90b] rounded hover:bg-[#f0b90b]/20 transition">Transfer</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="7" className="text-center text-[#848e9c] text-xs py-8">No coins found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
