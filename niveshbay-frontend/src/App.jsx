import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import TradePage from './pages/TradePage';
import MarketsPage from './pages/MarketsPage';
import LeaderboardPage from './pages/LeaderboardPage';

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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/trade/:symbol" element={<AuthGuard><TradePage /></AuthGuard>} />
      <Route path="/trade" element={<Navigate to="/trade/SOL-INR" replace />} />
      <Route path="/markets" element={<AuthGuard><MarketsPage /></AuthGuard>} />
      <Route path="/leaderboard" element={<AuthGuard><LeaderboardPage /></AuthGuard>} />
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
