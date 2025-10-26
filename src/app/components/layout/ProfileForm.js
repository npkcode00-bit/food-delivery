'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [address,   setAddress]   = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');
  const [role,      setRole]      = useState('');

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : { message: await res.text() };
      if (!res.ok) throw new Error(data?.message || 'Failed to load profile');

      const u = data.user || {};
      setFirstName(u.firstName || '');
      setLastName(u.lastName || '');
      setAddress(u.address || '');
      setPhone(u.phone || '');
      setEmail(u.email || '');
      setRole(u.role || (u.admin ? 'admin' : 'customer'));
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfile(); }, []);

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, address, phone }),
      });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : { message: await res.text() };
      if (!res.ok) throw new Error(data?.message || 'Failed to update profile');

      toast.success('Profile updated');
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'mt-1 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-4 py-2 text-zinc-800 outline-none transition ' +
    'placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30 disabled:bg-zinc-100';

  const readOnlyCls =
    'mt-1 w-full rounded-xl border border-zinc-300/70 bg-zinc-50 px-4 py-2 text-zinc-700';

  return (
    // Center the form itself (in case the parent isn’t constraining)
    <form className="max-w-3xl mx-auto" onSubmit={onSave}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">First name</label>
          <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading || saving} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Last name</label>
          <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading || saving} required />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700">Address</label>
        <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} disabled={loading || saving} required />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700">Phone</label>
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading || saving} required />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Email</label>
          <input className={readOnlyCls} value={email} disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Role</label>
          <input className={readOnlyCls} value={role} disabled />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={loadProfile}
          disabled={loading || saving}
          className="cursor-pointer inline-flex items-center justify-center rounded-full border border-[#B08B62]/50 bg-white/80 px-6 py-2.5 font-semibold text-zinc-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/50 disabled:opacity-60"
        >
          Reset
        </button>

        <button
          type="submit"
          disabled={loading || saving}
          style={{ color: 'white' }}
          className="cursor-pointer inline-flex items-center justify-center rounded-full border border-white/30 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-6 py-2.5 text-white shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
