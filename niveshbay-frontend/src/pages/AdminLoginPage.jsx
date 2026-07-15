import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/bullionsx-logo.png';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, login, loading: authLoading } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/admin/withdrawals', { replace: true });
    }
  }, [user, authLoading, navigate]);

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!password) return setError('Password is required.');

    setSubmitting(true);
    setError('');

    try {
      const res = await adminLogin({ email: 'admin@gmail.com', password });
      if (res.token) {
        login(res.token, { email: 'admin@gmail.com', ...res.user });
        toast.success('Admin logged in successfully!');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Admin login failed.';
      setError(msg);
      toast.error(msg);
    }
    setSubmitting(false);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="NiveshBay" className="mx-auto max-h-16 object-contain" />
          <p className="text-yellow-400 mt-2 text-sm font-semibold">Admin Panel</p>
        </div>

        <div className="bg-[#141822] rounded-2xl border border-yellow-800/50 p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-2">Admin Sign In</h2>
          <p className="text-gray-500 text-sm mb-6">Use your admin credentials to access the admin panel.</p>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value="admin@gmail.com"
                disabled
                className="w-full bg-[#1e2433] border border-gray-700 rounded-lg px-4 py-3 text-gray-400 text-sm cursor-not-allowed opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter admin password"
                  className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 pr-14 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                    error ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-yellow-500/30 focus:border-yellow-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-3 rounded-lg transition text-sm shadow-lg flex items-center justify-center gap-2"
            >
              {submitting && <span className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />}
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            <button
              onClick={() => navigate('/login')}
              className="text-gray-400 hover:text-white font-medium transition"
            >
              ← Back to user login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
