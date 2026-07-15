import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp, resetPassword } from '../api/auth';
import { validateEmail, validatePassword } from '../utils/validators';
import logo from '../assets/bullionsx-logo.png';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);
  const otpRefs = useRef([]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const [globalError, setGlobalError] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer]);

  function validateEmailInput() {
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSendOtp() {
    if (!validateEmailInput()) return;
    setGlobalError('');
    setResetError('');
    setEmailSending(true);

    try {
      const res = await sendOtp({ email, purpose: 'reset-password' });
      if (res.success) {
        setStep(2);
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError('');
        setTimer(600);
        toast.success('OTP sent to your email.');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (err) {
      setGlobalError(err?.response?.data?.error || 'Failed to send OTP.');
      toast.error(err?.response?.data?.error || 'Failed to send OTP.');
    }
    setEmailSending(false);
  }

  function handleOtpChange(index, value) {
    if (value && !/^\d$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    setOtpError('');

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtpDigits(text.split(''));
      setOtpError('');
      otpRefs.current[5]?.focus();
    }
  }

  async function handleVerifyOtp() {
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setOtpError('Enter all 6 digits.');
      return;
    }

    setOtpVerifying(true);
    setGlobalError('');

    try {
      const res = await verifyOtp({ email, otp, purpose: 'reset-password' });
      if (res.verified) {
        setStep(3);
        if (timerRef.current) clearTimeout(timerRef.current);
        setTimer(0);
        toast.success('OTP verified successfully!');
      }
    } catch (err) {
      setOtpError(err?.response?.data?.message || err?.response?.data?.error || 'Invalid OTP.');
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Invalid OTP.');
    }
    setOtpVerifying(false);
  }

  function handleResendOtp() {
    setTimer(0);
    setStep(1);
    setOtpDigits(['', '', '', '', '', '']);
  }

  async function handleResetPassword() {
    setResetError('');
    setGlobalError('');

    const passErr = validatePassword(newPassword);
    if (passErr) {
      setResetError(passErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetting(true);

    try {
      const res = await resetPassword({ email, newPassword, confirmPassword });
      if (res.success) {
        toast.success('Password reset successfully!');
        navigate('/login?reset=success');
      }
    } catch (err) {
      setResetError(err?.response?.data?.error || 'Failed to reset password.');
      toast.error(err?.response?.data?.error || 'Failed to reset password.');
    }
    setResetting(false);
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo Section */}
        <div className="text-center mb-8">
          <img src={logo} alt="NiveshBay" className="mx-auto max-h-16 object-contain" />
          <p className="text-gray-400 mt-2 text-sm">Reset your password</p>
        </div>

        {/* Card Box */}
        <div className="bg-[#141822] rounded-2xl border border-gray-800 p-8 shadow-2xl">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  step >= s ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-500'
                }`}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={`w-8 h-0.5 transition ${
                    step > s ? 'bg-green-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {globalError && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-5 animate-pulse">
              {globalError}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white">Enter Your Email</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                We'll send a 6-digit OTP to your email.
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  placeholder="yourname@gmail.com"
                  className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                    emailError ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                  }`}
                />
                {emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={emailSending}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition text-sm shadow-lg flex items-center justify-center gap-2"
              >
                {emailSending && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {emailSending ? 'Sending OTP…' : 'Send OTP'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white">Verify OTP</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Enter the 6-digit code sent to <span className="text-green-400 font-medium">{email}</span>
              </p>

              <div>
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`w-11 h-12 text-center text-white text-lg font-semibold bg-[#1e2433] border rounded-lg focus:outline-none focus:ring-2 transition ${
                        otpError ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                      }`}
                    />
                  ))}
                </div>
                {otpError && <p className="text-red-400 text-xs text-center mt-2">{otpError}</p>}
              </div>

              {timer > 0 ? (
                <p className="text-gray-500 text-sm text-center font-medium">
                  OTP expires in {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
                </p>
              ) : (
                <p className="text-gray-500 text-sm text-center font-medium">
                  OTP expired.{' '}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-green-400 hover:text-green-300 underline"
                  >
                    Resend OTP
                  </button>
                </p>
              )}

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={otpVerifying || otpDigits.join('').length !== 6}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition text-sm shadow-lg flex items-center justify-center gap-2"
              >
                {otpVerifying && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {otpVerifying ? 'Verifying…' : 'Verify OTP'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white">Set New Password</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Choose a strong password for your account.
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value);
                      setResetError('');
                    }}
                    placeholder="Min 8 chars, 1 capital, 1 number, 1 special"
                    className={`w-full bg-[#1e2433] border rounded-lg px-4 py-3 pr-10 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
                      resetError ? 'border-red-600 focus:ring-red-600/30' : 'border-gray-700 focus:ring-green-500/30 focus:border-green-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setResetError('');
                  }}
                  placeholder="Re-enter password"
                  className="w-full bg-[#1e2433] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition"
                />
              </div>

              {newPassword.length > 0 && (
                <ul className="space-y-1 bg-gray-850 p-3 rounded-lg border border-gray-800">
                  {[
                    { ok: newPassword.length >= 8, label: 'At least 8 characters' },
                    { ok: /[A-Z]/.test(newPassword), label: 'One uppercase letter' },
                    { ok: /[0-9]/.test(newPassword), label: 'One number' },
                    { ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword), label: 'One special character' },
                  ].map(r => (
                    <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.ok ? 'text-green-400' : 'text-gray-650'}`}>
                      <span>{r.ok ? '✓' : '○'}</span> {r.label}
                    </li>
                  ))}
                </ul>
              )}

              {resetError && <p className="text-red-400 text-xs">{resetError}</p>}

              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition text-sm shadow-lg flex items-center justify-center gap-2"
              >
                {resetting && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {resetting ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          )}

          {/* Card Footer */}
          <div className="text-center mt-6">
            <Link to="/login" className="text-green-400 hover:text-green-300 font-medium text-sm transition">
              Back to Sign In
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
