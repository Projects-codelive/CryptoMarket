import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginUser, verifyOtp } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/validators';
import logo from '../assets/bullionsx-logo.png';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login, loading: authLoading } = useAuth();

  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const resetSuccess = searchParams.get('reset') === 'success';

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/trade/SOL-INR', { replace: true });
    }
  }, [user, authLoading, navigate]);

  function handleError(field, msg) {
    setErrors(p => ({ ...p, [field]: msg }));
  }

  async function handleCredentialsSubmit(ev) {
    ev.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) return handleError('email', emailErr);
    if (!password) return handleError('password', 'Password is required.');

    setSubmitting(true);
    setErrors({});

    try {
      const res = await loginUser({ email, password });
      if (res.message) {
        setStep('otp');
        toast.success('OTP sent to your email.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Login failed.';
      setErrors({ form: msg });
      toast.error(msg);
    }
    setSubmitting(false);
  }

  async function handleOtpSubmit(ev) {
    ev.preventDefault();
    if (otpValue.length !== 6) {
      return handleError('otp', 'Enter a 6-digit OTP.');
    }

    setSubmitting(true);
    setErrors({});

    try {
      const res = await verifyOtp({ email, otp: otpValue, purpose: 'login' });
      if (res.token) {
        login(res.token, { email, ...res.user });
        toast.success('Logged in successfully!');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Invalid OTP.';
      setErrors({ otp: msg });
      toast.error(msg);
    }
    setSubmitting(false);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full mx-auto mb-4" />
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
          <p className="text-gray-400 mt-2 text-sm">Practice trading with $2,000 virtual money</p>
        </div>

        <div className="bg-[#141822] rounded-2xl border border-gray-800 p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">
            {step === 'otp' ? 'Verify OTP' : 'Sign In'}
          </h2>

          {resetSuccess && (
            <div className="bg-green-950 border border-green-800 text-green-300 text-sm rounded-lg px-4 py-3 mb-5">
              Password reset successful. Please sign in.
            </div>
          )}

          {errors.form && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-5">
              {errors.form}
            </div>
          )}

          {step === 'otp' && (
            <div className="bg-blue-950 border border-blue-800 text-blue-300 text-sm rounded-lg px-4 py-3 mb-5">
              OTP sent to <strong>{email}</strong>. Please check your inbox.
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-5" noValidate>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setErrors(p => ({ ...p, email: undefined, form: undefined }));
                  }}
                  placeholder="yourname@gmail.com"
                  className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                    errors.email ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                  }`}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      setErrors(p => ({ ...p, password: undefined, form: undefined }));
                    }}
                    placeholder="Enter your password"
                    className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 pr-14 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                      errors.password ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
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
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                <div className="mt-2 text-left">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-gray-500 hover:text-green-400 transition inline-block"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition text-sm shadow-lg flex items-center justify-center gap-2"
              >
                {submitting && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {submitting ? 'Sending OTP…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5" noValidate>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Enter 6-digit OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpValue}
                  onChange={e => {
                    setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setErrors(p => ({ ...p, otp: undefined }));
                  }}
                  placeholder="6-digit code"
                  className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                    errors.otp ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                  }`}
                />
                {errors.otp && <p className="text-red-400 text-xs mt-1">{errors.otp}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting || otpValue.length !== 6}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition text-sm shadow-lg flex items-center justify-center gap-2"
              >
                {submitting && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {submitting ? 'Verifying…' : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setOtpValue(''); setErrors({}); }}
                className="w-full text-gray-500 hover:text-gray-300 text-sm transition"
              >
                ← Back to login
              </button>
            </form>
          )}

          <p className="text-center text-gray-500 text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-green-400 hover:text-green-300 font-medium ml-1">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
