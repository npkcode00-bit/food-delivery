'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

function getErrorMessage(code) {
  switch (code) {
    case 'CredentialsSignin':
      return 'Invalid email or password.';
    case 'AccessDenied':
      return 'Access denied.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [error, setError] = useState('');

  // If NextAuth ever appends ?error=..., show it inline (but we won't redirect anymore)
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(getErrorMessage(err));
  }, [searchParams]);

  async function handleFormSubmit(ev) {
    ev.preventDefault();
    setError('');
    setLoginInProgress(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false, // <— prevents redirect to /api/auth/signin
      });

      if (res?.error) {
        setError(getErrorMessage(res.error));
      } else {
        router.push('/'); // success
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoginInProgress(false);
    }
  }

  return (
    <section className="mt-8">
      <h1 className="text-center text-primary text-4xl mb-4">Login</h1>

      {error && <div className="my-4 text-center text-red-500">{error}</div>}

      <form className="max-w-xs mx-auto" onSubmit={handleFormSubmit}>
        <input
          type="email"
          name="email"
          placeholder="email"
          value={email}
          disabled={loginInProgress}
          onChange={(ev) => setEmail(ev.target.value)}
          className="mb-2 w-full border p-2 rounded"
        />
        <input
          type="password"
          name="password"
          placeholder="password"
          value={password}
          disabled={loginInProgress}
          onChange={(ev) => setPassword(ev.target.value)}
          className="mb-4 w-full border p-2 rounded"
        />
        <button
          disabled={loginInProgress}
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50 cursor-pointer"
        >
          {loginInProgress ? 'Logging in…' : 'Login'}
        </button>

        <div className="text-center my-4 text-gray-500">
          No account?
          <Link className="underline ml-1" href="/register">
            Register here
          </Link>
        </div>
      </form>
    </section>
  );
}
