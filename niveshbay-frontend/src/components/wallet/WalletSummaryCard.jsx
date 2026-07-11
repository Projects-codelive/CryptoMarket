// components/wallet/WalletSummaryCard.jsx
// Reusable top-level balance card for all wallet pages.
// Pass showActions=false to hide Deposit / Withdraw / History buttons (Fund & Share wallets).

export default function WalletSummaryCard({ label = 'Estimated Total Value', value = 0, onDeposit, onWithdraw, onHistory, showActions = true }) {
  return (
    <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="text-[#848e9c] text-xs uppercase tracking-wider">{label}</span>
          <div className="text-2xl font-bold mt-1">
            <span className="text-[#848e9c] text-sm mr-1">INR</span>
            {value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2">
            {onDeposit && (
              <button
                onClick={onDeposit}
                className="px-4 py-2 bg-[#0ecb81] text-black text-xs font-semibold rounded hover:bg-[#0ecb81]/90 transition"
              >
                Deposit
              </button>
            )}
            {onWithdraw && (
              <button
                onClick={onWithdraw}
                className="px-4 py-2 bg-[#f6465d] text-white text-xs font-semibold rounded hover:bg-[#f6465d]/90 transition"
              >
                Withdraw
              </button>
            )}
            {onHistory && (
              <button
                onClick={onHistory}
                className="px-4 py-2 border border-[#2b3548] text-[#848e9c] text-xs font-semibold rounded hover:text-white transition"
              >
                History
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}