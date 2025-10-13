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
  const [email,     setEmail]     = useState('');   // read-only display
  const [role,      setRole]      = useState('');   // read-only display

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

  useEffect(() => {
    loadProfile();
  }, []);

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

  return (
    <form className="max-w-xl space-y-4" onSubmit={onSave}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">First name</label>
          <input
            className="border rounded-md w-full px-3 py-2"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={loading || saving}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Last name</label>
          <input
            className="border rounded-md w-full px-3 py-2"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={loading || saving}
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Address</label>
        <input
          className="border rounded-md w-full px-3 py-2"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={loading || saving}
          required
        />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Phone</label>
        <input
          className="border rounded-md w-full px-3 py-2"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading || saving}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email</label>
          <input
            className="border rounded-md w-full px-3 py-2 bg-gray-50"
            value={email}
            disabled
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Role</label>
          <input
            className="border rounded-md w-full px-3 py-2 bg-gray-50"
            value={role}
            disabled
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
          <button
          type="button"
          className="border rounded-md px-6 py-2 cursor-pointer"
          onClick={loadProfile}
          disabled={loading || saving}
        >
          Reset
        </button>

        <button
          type="submit"
          className="bg-primary text-white rounded-md px-6 py-2 disabled:opacity-60 cursor-pointer"
          disabled={loading || saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      
      </div>
    </form>
  );
}
