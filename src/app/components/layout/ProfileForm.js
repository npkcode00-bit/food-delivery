// app/components/profile/ProfileForm.jsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

// Barangays of San Mateo, Rizal
const BARANGAYS = [
  'Ampid 1',
  'Ampid 2',
  'Banaba',
  'Dulong Bayan 1',
  'Dulong Bayan 2',
  'Guinayang',
  'Guitnang Bayan 1',
  'Guitnang Bayan 2',
  'Gulod Malaya',
  'Malanday',
  'Maly',
  'Pintong Bukawe',
  'Santa Ana',
  'Santo Niño',
  'Silangan',
];

export default function ProfileForm() {
  const { data: session, update: updateSession } = useSession();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    street: '',
    barangay: BARANGAYS[0],
    city: 'San Mateo',
    province: 'Rizal',
    phone: '',
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        const user = data.user || {};

        // ----- smart fallback from `address` for old users -----
        let street = user.street || '';
        let barangay = user.barangay || '';
        let city = user.city || 'San Mateo';
        let province = user.province || 'Rizal';

        if (!street && typeof user.address === 'string') {
          const parts = user.address.split(',').map((p) => p.trim());
          // very basic best-effort split: "street, barangay, city, province"
          street = parts[0] || street;
          barangay = parts[1] || barangay;
          city = parts[2] || city;
          province = parts[3] || province;
        }

        setForm({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          street: street || '',
          barangay: barangay || BARANGAYS[0],
          city,
          province,
          phone: user.phone || '',
        });
      } catch (err) {
        console.error(err);
        toast.error('Failed to load profile.');
      } finally {
        setFetching(false);
      }
    }

    loadProfile();
  }, []);

  function update(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Update failed.');
        return;
      }

      // Update session with new data
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          ...data.user,
        },
      });

      toast.success('Profile updated successfully!');
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

  if (fetching) {
    return (
      <div className="text-center py-8 text-zinc-500">
        Loading profile...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            className={inputCls}
            type="text"
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            className={inputCls}
            type="text"
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-700">
          Street Address <span className="text-red-500">*</span>
        </label>
        <input
          className={inputCls}
          type="text"
          placeholder="e.g., 123 Main Street, Block 5 Lot 10"
          value={form.street}
          onChange={(e) => update('street', e.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-700">
          Barangay <span className="text-red-500">*</span>
        </label>
        <select
          className={inputCls}
          value={form.barangay}
          onChange={(e) => update('barangay', e.target.value)}
          required
        >
          {BARANGAYS.map((brgy) => (
            <option key={brgy} value={brgy}>
              {brgy}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            City
          </label>
          <input
            className={inputCls + ' bg-zinc-100 cursor-not-allowed'}
            type="text"
            value={form.city}
            disabled
            readOnly
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Province
          </label>
          <input
            className={inputCls + ' bg-zinc-100 cursor-not-allowed'}
            type="text"
            value={form.province}
            disabled
            readOnly
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-700">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          className={inputCls}
          type="tel"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          required
        />
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
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
