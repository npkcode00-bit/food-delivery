'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputCls =
    'w-full rounded-xl border border-zinc-300/70 bg-white/90 px-4 py-2.5 text-zinc-800 ' +
    'outline-none transition placeholder:text-zinc-400 ' +
    'focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30';

  async function handleSendCode(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();

      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message || 'Failed to send code.');
        return;
      }
      toast.success('If that email exists, a code was sent.');
      setStep(2);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanOtp = otp.trim();

      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: cleanOtp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message || 'Failed to reset password.');
        return;
      }
      toast.success('Password updated! Please log in.');
      router.push('/login');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const handleBack = () => {
    setStep(1);
    setOtp('');
    setNewPassword('');
  };

  return (
    <section className="relative">
      {/* Background gradients (same style as register/login) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 md:px-12 py-10">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/30 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
          {step === 1 ? (
            <>
              <h1 className="text-center text-2xl font-semibold text-zinc-900">
                Forgot your password?
              </h1>
              <p className="mt-1 text-center text-sm text-zinc-600">
                Enter your email and we&apos;ll send you a 6-digit code.
              </p>

              <form onSubmit={handleSendCode} className="mt-6 grid gap-3">
                <input
                  className={inputCls}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{ color: 'white' }}
                  className="cursor-pointer inline-flex items-center justify-center rounded-full border border-white/30 
                             bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2.5 text-white 
                             shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40 
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60 disabled:opacity-60"
                >
                  {loading ? 'Sending code…' : 'Send code'}
                </button>

                <p className="text-center text-sm text-zinc-600">
                  Remember your password?{' '}
                  <Link className="font-semibold text-[#7A4E2A] underline" href="/login">
                    Log in
                  </Link>
                </p>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-center text-2xl font-semibold text-zinc-900">
                Reset your password
              </h1>
              <p className="mt-1 text-center text-sm text-zinc-600">
                Enter the 6-digit code sent to <strong>{email}</strong> and choose a new password.
              </p>

              <form onSubmit={handleReset} className="mt-6 grid gap-3">
                <input
                  className={`${inputCls} text-center tracking-[0.3em]`}
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                  maxLength={6}
                />

                <div className="relative">
                  <input
                    className={inputCls + ' pr-12'}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password (min 5 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={5}
                  />
                  <span
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute cursor-pointer inset-y-0 right-4 flex items-center text-xs font-medium text-zinc-500 hover:text-zinc-700 focus:outline-none"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  style={{ color: 'white' }}
                  className="cursor-pointer inline-flex items-center justify-center rounded-full border border-white/30 
                             bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2.5 text-white 
                             shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40 
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60 disabled:opacity-60"
                >
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="text-sm text-[#7A4E2A] hover:underline cursor-pointer"
                >
                  ← Back
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
