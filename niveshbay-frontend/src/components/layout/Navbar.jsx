import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatCurrency';

export default function Navbar({ balance, portfolioValue, realizedPnl }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="h-16 bg-[#0b0f19] border-b border-[#1e2433] flex items-center px-4 gap-4 shrink-0 justify-between select-none">
      {/* Brand Logo */}
      <div className="flex items-center gap-6">
        <Link to="/trade/SOL-USDT" className="flex items-center gap-2 shrink-0">
          <img src="/src/assets/bullionsx-logo.png" alt="BullionsX" className="h-8 object-contain" onError={(e) => {
            e.target.style.display = 'none';
          }} />
          {/* <span className="text-white font-bold text-lg tracking-wider bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent flex items-center gap-1.5">
            NiveshBay
          </span> */}
        </Link>

      </div>

      {/* Portfolio Info & Auth Controls */}
      <div className="flex items-center gap-6 ml-auto">
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-[#848e9c] text-[10px] block uppercase tracking-wider">Balance</span>
            <p className="text-white font-bold text-sm tracking-wide">{formatCurrency(balance, 'USDT')}</p>
          </div>
          <div className="text-right border-l border-[#1e2433] pl-4">
            <span className="text-[#848e9c] text-[10px] block uppercase tracking-wider">Portfolio</span>
            <p className="text-[#0ecb81] font-bold text-sm tracking-wide">{formatCurrency(portfolioValue, 'USDT')}</p>
          </div>
          <div className="text-right border-l border-[#1e2433] pl-4">
            <span className="text-[#848e9c] text-[10px] block uppercase tracking-wider">Realized P&L</span>
            <p className={`font-bold text-sm tracking-wide ${realizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {realizedPnl >= 0 ? '+' : ''}{formatCurrency(realizedPnl, 'USDT')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Wallet Button */}
          <Link
            to="/wallet"
            className="flex items-center text-xs font-semibold px-3 py-1.5 border border-[#ffd333] text-[#ffd333] rounded bg-[#1e2330] hover:bg-[#ffd333]/15 transition gap-1"
          >
            <svg className="w-3.5 h-3.5 text-[#ffd333]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
            Wallet
          </Link>

          {/* Staking Button */}
          <Link
            to="/staking"
            className="flex items-center text-xs font-semibold px-3 py-1.5 border border-[#ffd333] text-[#ffd333] rounded bg-[#1e2330] hover:bg-[#ffd333]/15 transition gap-1"
          >
            <svg className="w-3.5 h-3.5 text-[#ffd333]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            Staking
          </Link>

          {/* Leaderboard Button */}
          <Link
            to="/leaderboard"
            className="flex items-center text-xs font-semibold px-3 py-1.5 border border-[#ffd333] text-[#ffd333] rounded bg-[#1e2330] hover:bg-[#ffd333]/15 transition gap-1"
          >
            <svg className="w-3.5 h-3.5 text-[#ffd333]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.2 1.8 4 4 4h1.7c.8 1.4 2.2 2.4 3.8 2.8V20H9v2h6v-2h-3.5v-3.2c1.6-.4 3-1.4 3.8-2.8H17c2.2 0 4-1.8 4-4V7c0-1.1-.9-2-2-2zM5 10V7h2v3H5zm14 0h-2V7h2v3z"/>
            </svg>
            Leaderboard
          </Link>

          {/* Markets Button */}
          <Link
            to="/markets"
            className="flex items-center text-xs font-semibold px-3 py-1.5 border border-[#2b3548] text-[#848e9c] hover:text-white rounded bg-[#141822] hover:bg-[#1e2433] transition gap-1"
          >
            <svg className="w-3.5 h-3.5 text-[#ffb800]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v7zm4 0h-2v-4h2v4z"/>
            </svg>
            Markets
          </Link>
        </div>

        {/* User Info / Sign Out */}
        <div className="flex items-center border-l border-[#1e2433] pl-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div
                onClick={() => navigate('/me')}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-[#0ecb81] flex items-center justify-center text-xs font-bold text-black">
                  {user.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-white text-xs font-semibold leading-tight">{user.first_name || 'User'}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-[#848e9c] hover:text-[#f6465d] text-xs font-medium cursor-pointer transition border border-transparent hover:border-[#f6465d]/20 px-2 py-1 rounded"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/login" className="text-[#0ecb81] hover:text-green-400 text-xs font-semibold">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

