'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [error, setError] = useState('');

  async function handleFormSubmit(ev) {
    ev.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 5) {
      setError('Password must be at least 5 characters.');
      return;
    }

    setCreatingUser(true);
    setError('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || 'Registration failed.');
      } else {
        setUserCreated(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCreatingUser(false);
    }
  }

  const canSubmit = !creatingUser && email && password.length >= 5;

  return (
    <section>
      <h1 className="text-center text-primary text-4xl mt-8 mb-4">Register</h1>

      {userCreated && (
        <div className="my-4 text-center">
          User created! <br />
          Now you can{' '}
          <Link className="underline" href="/login">
            Login &raquo;
          </Link>
        </div>
      )}

      {error && <div className="my-4 text-center text-red-500">{error}</div>}

      <form className="block max-w-xs mx-auto" onSubmit={handleFormSubmit}>
        <input
          type="email"
          placeholder="email"
          disabled={creatingUser}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-2 w-full border p-2 rounded"
        />
        <input
          type="password"
          placeholder="password"
          disabled={creatingUser}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full border p-2 rounded"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50"
        >
          {creatingUser ? 'Creating…' : 'Register'}
        </button>

        <div className="text-center my-4 text-gray-500">
          Existing account?
          <Link className="underline ml-1" href="/login">
            Login here
          </Link>
        </div>
      </form>
    </section>
  );
}
