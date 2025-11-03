'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: registration form, 2: OTP verification
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    address: '',
    phone: '',
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // 👇 NEW: controls show/hide password
  const [showPassword, setShowPassword] = useState(false);

  function update(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function onSubmitRegistration(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message || 'Registration failed.');
        return;
      }
      toast.success('Verification code sent to your email!');
      setStep(2);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitOTP(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message || 'Verification failed.');
        return;
      }
      toast.success('Account verified! Please log in.');
      router.push('/login');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-zinc-300/70 bg-white/90 px-4 py-2.5 text-zinc-800 ' +
    'outline-none transition placeholder:text-zinc-400 ' +
    'focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30';

  return (
    <section className="relative">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 md:px-12 py-10">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/30 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
          {step === 1 ? (
            <>
              <h1 className="text-center text-2xl font-semibold text-zinc-900">Create an account</h1>
              <p className="mt-1 text-center text-sm text-zinc-600">
                Join Pinagpala Cafe ☕ — it only takes a minute.
              </p>

              <form onSubmit={onSubmitRegistration} className="mt-6 grid grid-cols-1 gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className={inputCls}
                    type="text"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    required
                  />
                  <input
                    className={inputCls}
                    type="text"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                    required
                  />
                </div>

                <input
                  className={inputCls}
                  type="text"
                  placeholder="Address"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  required
                />

                <input
                  className={inputCls}
                  type="tel"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  required
                />

                <input
                  className={inputCls}
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                />

                {/* 👇 Password with show/hide toggle */}
                <div className="relative">
                  <input
                    className={inputCls + ' pr-12'} // extra right padding for the button
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password (min 5 chars)"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    required
                    minLength={5}
                  />
                  <span
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    className="absolute cursor-pointer inset-y-0 right-4 flex items-center text-xs font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-60"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ color: 'white' }}
                  className="cursor-pointer inline-flex items-center justify-center rounded-full border border-white/30 
                             bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2.5 text-white 
                             shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40 
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60 disabled:opacity-60"
                >
                  {loading ? 'Sending code…' : 'Continue'}
                </button>

                <p className="text-center text-sm text-zinc-600">
                  Already have an account?{' '}
                  <Link className="font-semibold text-[#7A4E2A] underline" href="/login">
                    Log in
                  </Link>
                </p>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-center text-2xl font-semibold text-zinc-900">Verify your email</h1>
              <p className="mt-1 text-center text-sm text-zinc-600">
                We sent a 6-digit code to <strong>{form.email}</strong>
              </p>

              <form onSubmit={onSubmitOTP} className="mt-6 grid grid-cols-1 gap-4">
                <div>
                  <input
                    className={`${inputCls} text-center text-2xl tracking-widest font-semibold`}
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    pattern="\d{6}"
                  />
                  <p className="mt-1 text-xs text-zinc-500 text-center">
                    Code expires in 10 minutes
                  </p>
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
                  {loading ? 'Verifying…' : 'Verify Email'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm text-[#7A4E2A] hover:underline"
                >
                  ← Back to registration
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
