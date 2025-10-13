'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    address: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e) {
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
      toast.success('Account created! Please log in.');
      router.push('/login');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto my-10">
      <h1 className="text-2xl font-semibold mb-6">Create an account</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          className="border rounded-md p-3"
          type="text"
          placeholder="First name"
          value={form.firstName}
          onChange={(e) => update('firstName', e.target.value)}
          required
        />
        <input
          className="border rounded-md p-3"
          type="text"
          placeholder="Last name"
          value={form.lastName}
          onChange={(e) => update('lastName', e.target.value)}
          required
        />
        <input
          className="border rounded-md p-3"
          type="text"
          placeholder="Address"
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
          required
        />
        <input
          className="border rounded-md p-3"
          type="tel"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          required
        />
        <input
          className="border rounded-md p-3"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          required
        />
        <input
          className="border rounded-md p-3"
          type="password"
          placeholder="Password (min 5 chars)"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          required
          minLength={5}
        />
        <button
          className="bg-primary text-white rounded-md p-3 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
