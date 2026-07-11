import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import TradePage from './pages/TradePage';
import MarketsPage from './pages/MarketsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import ProfileUpdatePage from './pages/ProfileUpdatePage';
import BalanceStatsPage from './pages/BalanceStatsPage';
import StakingPage from './pages/StakingPage';
import MyStakingPage from './pages/MyStakingPage';
import AdminStakingPage from './pages/AdminStakingPage';
import AdminWithdrawalsPage from './pages/AdminWithdrawalsPage';

// ── Wallet pages ──────────────────────────────────────────────────────────────
// SpotWalletPage  replaces the old WalletOverviewPage (same UI, zero logic change)
// FundWalletPage  & ShareWalletPage are new read-only wallet views
import SpotWalletPage  from './pages/wallet/SpotWalletPage';
import FundWalletPage  from './pages/wallet/FundWalletPage';
import ShareWalletPage from './pages/wallet/ShareWalletPage';
import CoinDepositPage  from './pages/wallet/CoinDepositPage';
import CoinWithdrawPage from './pages/wallet/CoinWithdrawPage';
import WalletHistoryPage from './pages/wallet/WalletHistoryPage';
// ─────────────────────────────────────────────────────────────────────────────

function AuthGuard({ children }) {
  const { token, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
    </div>
  );
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Auth ─────────────────────────────────────────────────────── */}
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/admin/login"      element={<AdminLoginPage />} />
      <Route path="/register"         element={<RegisterPage />} />
      <Route path="/forgot-password"  element={<ForgotPasswordPage />} />

      {/* ── App ──────────────────────────────────────────────────────── */}
      <Route path="/trade/:symbol" element={<AuthGuard><TradePage /></AuthGuard>} />
      <Route path="/trade"         element={<Navigate to="/trade/SOL-INR" replace />} />
      <Route path="/markets"       element={<AuthGuard><MarketsPage /></AuthGuard>} />
      <Route path="/leaderboard"   element={<AuthGuard><LeaderboardPage /></AuthGuard>} />
      <Route path="/me"            element={<AuthGuard><ProfilePage /></AuthGuard>} />
      <Route path="/me/update"     element={<AuthGuard><ProfileUpdatePage /></AuthGuard>} />
      <Route path="/balance"       element={<AuthGuard><BalanceStatsPage /></AuthGuard>} />
      <Route path="/staking"       element={<AuthGuard><StakingPage /></AuthGuard>} />
      <Route path="/my-staking"    element={<AuthGuard><MyStakingPage /></AuthGuard>} />
      <Route path="/admin/staking"      element={<AuthGuard><AdminStakingPage /></AuthGuard>} />
      <Route path="/admin/withdrawals"  element={<AuthGuard><AdminWithdrawalsPage /></AuthGuard>} />

      {/* ── Wallet ───────────────────────────────────────────────────── */}
      {/* /wallet  →  redirect to /wallet/spot (backwards-compatible) */}
      <Route path="/wallet" element={<Navigate to="/wallet/spot" replace />} />

      {/* Three independent wallet pages */}
      <Route path="/wallet/spot"  element={<AuthGuard><SpotWalletPage /></AuthGuard>} />
      <Route path="/wallet/fund"  element={<AuthGuard><FundWalletPage /></AuthGuard>} />
      <Route path="/wallet/share" element={<AuthGuard><ShareWalletPage /></AuthGuard>} />

      {/* Sub-pages (deposit / withdraw / history) remain unchanged */}
      <Route path="/wallet/deposit/:symbol"  element={<AuthGuard><CoinDepositPage /></AuthGuard>} />
      <Route path="/wallet/withdraw/:symbol" element={<AuthGuard><CoinWithdrawPage /></AuthGuard>} />
      <Route path="/wallet/history"          element={<AuthGuard><WalletHistoryPage /></AuthGuard>} />

      {/* ── Fallback ─────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/trade/SOL-INR" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#161a1e',
                color: '#eaecef',
                border: '1px solid #2b2f36',
              },
            }}
          />
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}