// components/common/TableShared.jsx
// Small reusable pieces used by TradeHistoryPage and BalanceLogPage.
// No dependency on wallet-specific logic.

// ── Page wrapper with Navbar already applied ──────────────────────────────────
export function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
export function Breadcrumb({ items }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#848e9c] mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span>/</span>}
          <span className={i === items.length - 1 ? 'text-white' : ''}>{item}</span>
        </span>
      ))}
    </div>
  );
}

// ── Filter input ──────────────────────────────────────────────────────────────
export function FilterInput({ value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#141822] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white placeholder-[#848e9c] focus:outline-none focus:border-[#f0b90b] transition ${className}`}
    />
  );
}

// ── Filter select ─────────────────────────────────────────────────────────────
export function FilterSelect({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`bg-[#141822] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f0b90b] transition ${className}`}
    >
      {children}
    </select>
  );
}

// ── Refresh button ────────────────────────────────────────────────────────────
export function RefreshButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-3 py-1.5 bg-[#141822] border border-[#2b3548] text-xs text-[#f0b90b] rounded hover:bg-[#1e2433] transition disabled:opacity-50 flex items-center gap-1.5"
    >
      <svg
        className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Refresh
    </button>
  );
}

// ── Loading spinner row ───────────────────────────────────────────────────────
export function TableLoading({ cols }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-[#f0b90b] border-t-transparent rounded-full mx-auto" />
      </td>
    </tr>
  );
}

// ── Empty state row ───────────────────────────────────────────────────────────
export function TableEmpty({ cols, message = 'No records found.' }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-12">
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-[#2b3548]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
          <p className="text-[#848e9c] text-xs">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// ── Error state row ───────────────────────────────────────────────────────────
export function TableError({ cols, message, onRetry }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-12">
        <p className="text-[#f6465d] text-xs mb-3">{message}</p>
        {onRetry && (
          <button onClick={onRetry}
            className="px-3 py-1.5 text-xs bg-[#141822] border border-[#2b3548] text-[#f0b90b] rounded hover:bg-[#1e2433] transition">
            Retry
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Pagination controls ───────────────────────────────────────────────────────
export function Pagination({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      <button
        onClick={onPrev} disabled={page === 0}
        className="px-3 py-1.5 text-xs bg-[#141822] border border-[#2b3548] rounded text-[#848e9c] hover:text-white disabled:opacity-40 transition"
      >
        Previous
      </button>
      <span className="text-xs text-[#848e9c]">Page {page + 1} of {totalPages}</span>
      <button
        onClick={onNext} disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-xs bg-[#141822] border border-[#2b3548] rounded text-[#848e9c] hover:text-white disabled:opacity-40 transition"
      >
        Next
      </button>
    </div>
  );
}

// ── Responsive table wrapper (horizontal scroll on mobile) ────────────────────
export function TableWrapper({ children }) {
  return (
    <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">{children}</table>
      </div>
    </div>
  );
}

// ── Table header cell ─────────────────────────────────────────────────────────
export function Th({ children, right = false }) {
  return (
    <th className={`px-4 py-3 font-medium text-[#848e9c] text-xs uppercase ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

// ── Table data cell ───────────────────────────────────────────────────────────
export function Td({ children, right = false, className = '' }) {
  return (
    <td className={`px-4 py-3 text-xs ${right ? 'text-right' : ''} ${className}`}>
      {children}
    </td>
  );
}
