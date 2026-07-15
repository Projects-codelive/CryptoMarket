import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, sendOtp, verifyOtp } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import {
  validateName,
  validatePhone,
  validateEmail,
  validatePassword,
  getPasswordStrength
} from '../utils/validators';
import logo from '../assets/bullionsx-logo.png';
import toast from 'react-hot-toast';

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, login, loading: authLoading } = useAuth();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    referral_id: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/trade/SOL-INR', { replace: true });
    }
  }, [user, authLoading, navigate]);

  function set(field, value) {
    setForm(p => ({ ...p, [field]: value }));
    setErrors(p => ({ ...p, [field]: undefined, form: undefined }));
  }

  const passwordStrength = getPasswordStrength(form.password);

  function validate() {
    const e = {};
    e.name = validateName(form.name) ?? undefined;
    e.phone = validatePhone(form.phone) ?? undefined;
    e.email = validateEmail(form.email) ?? undefined;
    if (!otpVerified) e.otp = 'Please verify your email with OTP first.';
    e.password = validatePassword(form.password) ?? undefined;
    if (form.password !== form.confirmPassword) {
      e.confirmPassword = 'Passwords do not match.';
    }
    setErrors(e);
    return Object.values(e).every(v => !v);
  }

  async function handleSendOtp() {
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) {
      setErrors(p => ({ ...p, phone: phoneErr }));
      return;
    }

    const emailErr = validateEmail(form.email);
    if (emailErr) {
      setErrors(p => ({ ...p, email: emailErr }));
      return;
    }

    setOtpSending(true);
    setErrors(p => ({ ...p, email: undefined, phone: undefined, form: undefined }));

    try {
      const res = await sendOtp({ email: form.email, phone: form.phone, purpose: 'register' });
      if (res.success) {
        setOtpSent(true);
        setOtpValue('');
        setOtpVerified(false);
        setTimer(600); // 10 minutes
        toast.success('OTP sent to your email.');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to send OTP.';
      setErrors(p => ({ ...p, email: msg }));
      toast.error(msg);
    }
    setOtpSending(false);
  }

  async function handleResendOtp() {
    await handleSendOtp();
  }

  async function handleVerifyOtp() {
    if (otpValue.length !== 6) {
      setErrors(p => ({ ...p, otp: 'Enter a 6-digit OTP.' }));
      return;
    }

    setOtpVerifying(true);
    setErrors(p => ({ ...p, otp: undefined, form: undefined }));

    try {
      const res = await verifyOtp({ email: form.email, otp: otpValue, purpose: 'register' });
      if (res.verified) {
        setOtpVerified(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        setTimer(0);
        toast.success('Email verified successfully!');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Invalid OTP.';
      setErrors(p => ({ ...p, otp: msg }));
      toast.error(msg);
    }
    setOtpVerifying(false);
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    try {
      const res = await registerUser(form);
      if (res.token) {
        login(res.token, { email: form.email, ...res.user });
        toast.success('Account created successfully!');
        navigate('/trade/SOL-INR');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Registration failed. Please try again.';
      setErrors({ form: msg });
      toast.error(msg);
    }
    setSubmitting(false);
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">

        {/* Logo Section */}
        <div className="text-center mb-8">
          <img src={logo} alt="NiveshBay" className="mx-auto max-h-16 object-contain" />
          <p className="text-gray-400 mt-2 text-sm">Create your free account — start with $2,000 virtual balance</p>
        </div>

        {/* Card Box */}
        <div className="bg-[#141822] rounded-2xl border border-gray-800 p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>

          {errors.form && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-5 animate-pulse">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Full Name */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Rahul Sharma"
                className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                  errors.name ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                }`}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Grid fields: Phone Number & Referral ID */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                    errors.phone ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                  }`}
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  {form.phone.length}/10 digits
                </span>
                {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Referral ID</label>
                <input
                  type="text"
                  value={form.referral_id}
                  onChange={e => set('referral_id', e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="e.g. ABC123"
                  className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                    errors.referral_id ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                  }`}
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Optional — 6-character referral code
                </span>
                {errors.referral_id && <p className="text-red-400 text-xs mt-1">{errors.referral_id}</p>}
              </div>
            </div>

            {/* Email Field with Send OTP Button */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={form.email}
                  disabled={otpVerified || otpSent}
                  onChange={e => set('email', e.target.value)}
                  placeholder="yourname@gmail.com"
                  className={`flex-1 bg-[#1e2433] border rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition disabled:opacity-50 ${
                    errors.email ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending || otpVerified || !form.email || form.phone.length !== 10}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold px-4 rounded-lg transition text-xs shadow-md"
                >
                  {otpSending ? 'Sending…' : otpSent ? 'Resend OTP' : 'Send OTP'}
                </button>
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Enter OTP Code Field (Conditionally Rendered) */}
            {otpSent && !otpVerified && (
              <div className="space-y-3 bg-gray-850 p-4 rounded-lg border border-gray-800">
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Enter 6-digit OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpValue}
                      onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      className={`w-full bg-[#1e2433] border rounded px-3 py-2 text-white placeholder-gray-650 text-xs focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 ${
                        errors.otp ? 'border-red-600' : 'border-gray-750'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpVerifying || otpValue.length !== 6}
                    className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold py-2 rounded transition text-xs shadow-sm"
                  >
                    {otpVerifying ? 'Verifying…' : 'Verify OTP'}
                  </button>
                </div>
                {errors.otp && <p className="text-red-400 text-xs">{errors.otp}</p>}
                {timer > 0 ? (
                  <p className="text-[11px] text-gray-500 text-center font-medium">
                    OTP expires in {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500 text-center font-medium">
                    OTP expired.{' '}
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-green-400 hover:text-green-300 underline ml-1"
                    >
                      Resend OTP
                    </button>
                  </p>
                )}
              </div>
            )}

            {/* Password input */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  disabled={!otpVerified}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min 8 chars, 1 capital, 1 number, 1 special"
                  className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 pr-10 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition disabled:opacity-50 ${
                    errors.password ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                  }`}
                />
                <button
                  type="button"
                  disabled={!otpVerified}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs disabled:opacity-50"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <span className={`text-[10px] mt-1.5 block font-medium ${otpVerified ? 'text-green-400' : 'text-gray-500'}`}>
                {otpVerified ? 'OTP Verified! You can now set your password.' : 'Verify OTP first to set password'}
              </span>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}

              {/* Password strength indicators */}
              {form.password.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Password strength:</span>
                    <span className={`font-semibold ${
                      passwordStrength <= 2 ? 'text-red-400' : passwordStrength === 3 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {STRENGTH_LABELS[passwordStrength]}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4].map(idx => (
                      <div
                        key={idx}
                        className={`h-full flex-1 transition ${
                          passwordStrength >= idx ? STRENGTH_COLORS[passwordStrength] : 'bg-gray-750'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password input */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                disabled={!otpVerified}
                onChange={e => set('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition disabled:opacity-50 ${
                  errors.confirmPassword ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                }`}
              />
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !otpVerified}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition text-sm shadow-lg flex items-center justify-center gap-2"
            >
              {submitting && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
              {submitting ? 'Creating account…' : 'Create Account — Get $2,000 Free'}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-green-400 hover:text-green-300 font-medium ml-1">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
