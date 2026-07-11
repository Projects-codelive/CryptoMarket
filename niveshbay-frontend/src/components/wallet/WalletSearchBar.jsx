// components/wallet/WalletSearchBar.jsx
// Reusable search + hide-zero-balance bar shared across all wallet pages.

export default function WalletSearchBar({ search, onSearchChange, hideZero, onHideZeroChange }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-4">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search coins..."
        className="bg-[#141822] border border-[#2b3548] rounded px-3 py-2 text-xs text-white placeholder-[#848e9c] focus:outline-none focus:border-[#f0b90b] w-64"
      />
      <label className="flex items-center gap-2 text-xs text-[#848e9c] cursor-pointer">
        <input
          type="checkbox"
          checked={hideZero}
          onChange={(e) => onHideZeroChange(e.target.checked)}
          className="accent-[#f0b90b]"
        />
        Hide zero balance
      </label>
    </div>
  );
}