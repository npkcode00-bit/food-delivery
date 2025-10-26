'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import Left from '../../components/icons/Left';
import UserTabs from '../../components/layout/UserTabs';
import MenuItemForm from '../../components/layout/MenuItemForm';

export default function NewMenuItemPage() {
  const { data: session, status } = useSession();
  const isAdmin = !!session?.user?.admin;
  const router = useRouter();

  // Gate: if authenticated but not admin, send away
  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) {
      router.replace('/'); // or '/login'
    }
  }, [status, isAdmin, router]);

  // Submit handler from MenuItemForm
  async function handleFormSubmit(ev, formData) {
    ev.preventDefault();
    const savingPromise = (async () => {
      const res = await fetch('/api/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Request failed');
    })();

    await toast.promise(savingPromise, {
      loading: 'Saving this tasty item…',
      success: 'Saved',
      error: 'Error, sorry…',
    });

    router.replace('/menu-items');
  }

  if (status === 'loading') return 'Loading user info…';
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
            <MenuItemForm menuItem={null} onSubmit={handleFormSubmit} />
          </div>
        </div>
      </div>
    </section>
  );
}
