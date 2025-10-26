// app/menu-items/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import Right from '../components/icons/Right';
import UserTabs from '../components/layout/UserTabs';

export default function MenuItemsPage() {
  const { data: session, status } = useSession();
  const isAdmin = !!session?.user?.admin;

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  // Fetch data (unchanged functionality)
  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      setLoadingItems(true);
      fetch('/api/menu-items')
        .then((r) => r.json())
        .then((items) => setMenuItems(Array.isArray(items) ? items : []))
        .catch(() => {})
        .finally(() => setLoadingItems(false));

      setLoadingCats(true);
      fetch('/api/categories')
        .then((r) => r.json())
        .then((cats) => setCategories(Array.isArray(cats) ? cats : []))
        .catch(() => {})
        .finally(() => setLoadingCats(false));
    }
  }, [status, isAdmin]);

  const FALLBACK_SRC = '/no-image.jpg';

  // ✅ Hooks are called unconditionally (before any early return)
  const visibleItems = useMemo(() => {
    if (selectedCategoryId === 'all') return menuItems;
    return menuItems.filter((it) => {
      const id = typeof it?.category === 'object' ? it.category?._id : it?.category;
      return id === selectedCategoryId;
    });
  }, [menuItems, selectedCategoryId]);

  // ---- Render guards (no more early-return before hooks) ----
  let content;
  if (status === 'loading') {
    content = <div className="p-4 text-center">Loading...</div>;
  } else if (status === 'unauthenticated') {
    content = <div className="p-4 text-center">Please log in.</div>;
  } else if (!isAdmin) {
    content = <div className="p-4 text-center">Not an admin.</div>;
  } else {
    content = (
      <>
        <UserTabs isAdmin={isAdmin} />

        {/* Header + Create button */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-zinc-900">Menu Items</h2>
          <Link
            href="/menu-items/new"
            className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2.5 text-white shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60"
          >
            Create new menu item
            <span className="transition-transform group-hover:translate-x-0.5"><Right /></span>
          </Link>
        </div>

        {/* Layout: sidebar + content */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Sidebar */}
          <aside className="md:col-span-3">
            {/* Mobile dropdown */}
            <div className="md:hidden">
              <select
                className="w-full rounded-xl border border-[#B08B62]/60 bg-white/80 px-4 py-2 text-zinc-700 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#8B5E34]/60"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="all">All items</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Desktop list */}
            <div className="sticky top-6 hidden md:block">
              <div className="rounded-2xl border border-white/30 bg-white/60 p-3 backdrop-blur-xl">
                <h3 className="px-2 pb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">
                  Categories
                </h3>
                <ul className="space-y-1">
                  {[{ _id: 'all', name: 'All items' }, ...categories].map((c) => {
                    const active = selectedCategoryId === c._id;
                    return (
                      <li key={c._id}>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedCategoryId(c._id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedCategoryId(c._id);
                            }
                          }}
                          className={[
                            'block w-full select-none text-left rounded-xl px-3 py-3 outline-none transition cursor-pointer',
                            'focus-visible:ring-2 focus-visible:ring-[#8B5E34]/50',
                            active
                              ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white shadow-lg shadow-[#A5724A]/25'
                              : 'text-zinc-700 hover:bg-white/80',
                          ].join(' ')}
                          aria-pressed={active}
                        >
                          {c.name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="md:col-span-9">
            <h4 className="mb-3 text-sm uppercase tracking-wide text-zinc-600">
              {selectedCategoryId === 'all'
                ? 'All items'
                : categories.find((c) => c._id === selectedCategoryId)?.name || 'Items'}
            </h4>

            {(loadingItems || loadingCats) && (
              <div className="rounded-xl border border-dashed border-zinc-300/70 bg-white/70 p-6 text-center text-zinc-500 backdrop-blur-md">
                Loading…
              </div>
            )}

            {!loadingItems && visibleItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-300/70 bg-white/70 p-6 text-center text-zinc-500 backdrop-blur-md">
                No items in this category yet.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleItems.map((item) => (
                <Link
                  key={item._id}
                  href={`/menu-items/edit/${item._id}`}
                  className="group overflow-hidden rounded-2xl border border-white/30 bg-white/70 p-3 shadow-sm backdrop-blur-md transition hover:shadow-lg"
                >
                  <div className="relative">
                    <Image
                      className="mx-auto rounded-lg"
                      src={item.image || FALLBACK_SRC}
                      alt={item.name ?? ''}
                      width={360}
                      height={240}
                    />
                  </div>
                  <div className="mt-3 text-center font-medium text-zinc-800">{item.name}</div>
                  <div className="mt-1 text-center text-xs text-zinc-500">Edit details →</div>
                </Link>
              ))}
            </div>
          </main>
        </div>
      </>
    );
  }

  // Outer shell with background (unchanged)
  return (
    <section className="relative">
      {/* background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl">
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        <div className="px-6 py-10 md:px-12 md:py-14">{content}</div>
      </div>
    </section>
  );
}
