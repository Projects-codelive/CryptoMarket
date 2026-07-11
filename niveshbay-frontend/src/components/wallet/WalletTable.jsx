// components/wallet/WalletTable.jsx
// Reusable coin table shared across Spot, Fund, and Share wallet pages.
//
// Props:
//   coins          – filtered array of coin rows to render
//   walletKey      – which balance field to display as the primary column
//                    'spot' | 'funding' | 'share'
//   columnLabel    – header label for that primary column (e.g. "Spot Balance")
//   onDeposit      – (coin) => void  — omit to hide Deposit button per row
//   onWithdraw     – (coin) => void  — omit to hide Withdraw button per row
//   onTransfer     – (coin) => void  — omit to hide Transfer button per row
//   onRowClick     – (coin) => void  — row click handler

import { formatAmount } from '../../utils/formatCurrency';

export default function WalletTable({
  coins = [],
  walletKey = 'spot',
  columnLabel = 'Balance',
  onDeposit,
  onWithdraw,
  onTransfer,
  onRowClick,
}) {
  const hasActions = onDeposit || onWithdraw || onTransfer;

  return (
    <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2b2f36] text-[#848e9c] text-xs uppercase">
            <th className="text-left px-4 py-3 font-medium">Coin</th>
            <th className="text-right px-4 py-3 font-medium">{columnLabel}</th>
            <th className="text-right px-4 py-3 font-medium">In Trade</th>
            <th className="text-right px-4 py-3 font-medium">Total</th>
            {hasActions && <th className="text-right px-4 py-3 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {coins.map((c) => (
            <tr
              key={c.coin || c.name || Math.random()}
              className="border-b border-[#1e2433] hover:bg-[#1e2433]/50 transition cursor-pointer"
              onClick={() => onRowClick && onRowClick(c)}
            >
              {/* Coin name/symbol */}
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

              {/* Primary balance for this wallet type */}
              <td className="text-right px-4 py-3 text-xs">{formatAmount(c[walletKey] ?? 0)}</td>

              {/* In-trade (locked in open orders) */}
              <td className="text-right px-4 py-3 text-xs text-[#f0b90b]">{formatAmount(c.inTrade)}</td>

              {/* Total across all wallets */}
              <td className="text-right px-4 py-3 text-xs font-semibold">{formatAmount(c.total)}</td>

              {/* Action buttons — only rendered when at least one handler is provided */}
              {hasActions && (
                <td className="text-right px-4 py-3">
                  <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {onDeposit && (
                      <button
                        onClick={() => onDeposit(c)}
                        className="px-2 py-1 text-[10px] bg-[#0ecb81]/10 text-[#0ecb81] rounded hover:bg-[#0ecb81]/20 transition"
                      >
                        Deposit
                      </button>
                    )}
                    {onWithdraw && (
                      <button
                        onClick={() => onWithdraw(c)}
                        className="px-2 py-1 text-[10px] bg-[#f6465d]/10 text-[#f6465d] rounded hover:bg-[#f6465d]/20 transition"
                      >
                        Withdraw
                      </button>
                    )}
                    {onTransfer && (
                      <button
                        onClick={() => onTransfer(c)}
                        className="px-2 py-1 text-[10px] bg-[#f0b90b]/10 text-[#f0b90b] rounded hover:bg-[#f0b90b]/20 transition"
                      >
                        Transfer
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}

          {coins.length === 0 && (
            <tr>
              <td colSpan={hasActions ? 5 : 4} className="text-center text-[#848e9c] text-xs py-8">
                No coins found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}