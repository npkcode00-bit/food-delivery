'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import Left from '../../../components/icons/Left';
import UserTabs from '../../../components/layout/UserTabs';
import MenuItemForm from '../../../components/layout/MenuItemForm';
import DeleteButton from '../../../components/DeleteButton';

export default function EditMenuItemPage() {
  const { data: session, status } = useSession();

  // support either `role === 'admin'` or a boolean `admin` flag
  const isAdmin =
    session?.user?.role === 'admin' ||
    session?.user?.admin === true;

  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [menuItem, setMenuItem] = useState(null);
  const [saving, setSaving] = useState(false);

  // kick non-admins out
  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) {
      router.replace('/');
    }
  }, [status, isAdmin, router]);

  // fetch the item only when authenticated & admin
  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin || !id) return;

    (async () => {
      try {
        const res = await fetch(`/api/menu-items?_id=${id}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setMenuItem(Array.isArray(data) ? data.find(i => i._id === id) ?? null : data);
          return;
        }
        // Fallback: fetch all, then find
        const allRes = await fetch('/api/menu-items', { cache: 'no-store' });
        if (!allRes.ok) throw new Error('Failed to load items');
        const all = await allRes.json();
        setMenuItem(all.find(i => i._id === id) ?? null);
      } catch (e) {
        toast.error(e?.message || 'Failed to load item');
      }
    })();
  }, [status, isAdmin, id]);

  // Accept both signatures: (event, data) or (data)
  async function handleFormSubmit(arg1, arg2) {
    let formData = arg2;
    if (arg1 && typeof arg1.preventDefault === 'function') {
      arg1.preventDefault();
    } else {
      formData = arg1;
    }

    setSaving(true);

    const savingPromise = (async () => {
      const res = await fetch('/api/menu-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, _id: id }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Request failed');
      }
    })();

    await toast.promise(savingPromise, {
      loading: 'Saving this tasty item…',
      success: 'Saved',
      error: (e) => e?.message || 'Error',
    });

    setSaving(false);
    router.replace('/menu-items');
    router.refresh(); // helpful if list uses SSR/ISR
  }

  async function handleDeleteClick() {
    const promise = (async () => {
      const res = await fetch(`/api/menu-items?_id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Delete failed');
      }
    })();

    await toast.promise(promise, {
      loading: 'Deleting...',
      success: 'Deleted',
      error: (e) => e?.message || 'Error',
    });

    router.replace('/menu-items');
    router.refresh();
  }

  if (status === 'loading') return 'Loading...';
  if (!isAdmin) return null; // brief blank while redirect runs

  return (
    <section className="relative">
      {/* soft mac-ish background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      {/* single window wrapper */}
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl">
        {/* glossy top highlight */}
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        {/* content */}
        <div className="px-6 py-10 md:px-12 md:py-14">
          <UserTabs isAdmin={isAdmin} />

          <div className="mt-6">
            <Link
              href="/menu-items"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2.5 text-white shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60"
              style={{ maxWidth: '250px' }}
            >
              <Left />
              <span>Show all menu items</span>
            </Link>
          </div>

          {/* form card */}
          <div className="mt-6 rounded-2xl border border-white/30 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
            <MenuItemForm
              key={menuItem?._id || 'blank'}
              menuItem={menuItem}
              onSubmit={handleFormSubmit}
            />
          </div>

          {/* delete action row */}
          <div className="mx-auto mt-4 max-w-md">
            <div className="ml-auto max-w-xs pl-2 text-right">
              <DeleteButton
                label="Delete this menu item"
                onDelete={handleDeleteClick}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
