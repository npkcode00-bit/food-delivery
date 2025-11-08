// app/menu/page.jsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import SectionHeaders from '../components/layout/SectionHeaders';
import MenuItem from '../components/menu/MenuItem';
import { useSession } from 'next-auth/react';

export default function MenuPage() {
  const { data: session, status } = useSession();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const role = session?.user?.role;
  const isAccounting =
    session?.user?.accounting === true || role === 'accounting';

  // ✅ Move ALL hooks to the top, before any early returns
  useEffect(() => {
    // Don't fetch if user is accounting
    if (status === 'authenticated' && isAccounting) {
      setLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        const [catsRes, itemsRes] = await Promise.all([
          fetch('/api/categories', { cache: 'no-store' }),
          fetch('/api/menu-items', { cache: 'no-store' }),
        ]);

        const [cats, items] = await Promise.all([
          catsRes.json(),
          itemsRes.json(),
        ]);

        if (!alive) return;
        const safeCats = Array.isArray(cats) ? cats : [];
        const safeItems = Array.isArray(items) ? items : [];
        setCategories(safeCats);
        setMenuItems(safeItems);
        if (safeCats.length && !selectedCategoryId) {
          setSelectedCategoryId(safeCats[0]._id);
        }
      } catch {
        if (!alive) return;
        setCategories([]);
        setMenuItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAccounting]);

  useEffect(() => {
    if (!categories.length) return;
    if (
      !selectedCategoryId ||
      !categories.some((c) => c._id === selectedCategoryId)
    ) {
      setSelectedCategoryId(categories[0]._id);
    }
  }, [categories, selectedCategoryId]);

  const currentCategory = useMemo(
    () => categories.find((c) => c._id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const itemsForSelected = useMemo(
    () => menuItems.filter((item) => item.category === selectedCategoryId),
    [menuItems, selectedCategoryId]
  );

  // ✅ NOW do the early return after all hooks
  if (status === 'authenticated' && isAccounting) {
    return (
      <section className="max-w-3xl mx-auto mt-16 text-center">
        <SectionHeaders
          mainHeader="Menu not available"
          subHeader="The customer menu is hidden for accounting users."
        />
        <p className="mt-4 text-sm text-zinc-600">
          Please use the <span className="font-semibold">Accounting</span> or{' '}
          <span className="font-semibold">Orders</span> sections to manage
          reports and transactions.
        </p>
      </section>
    );
  }

  return (
    <section className="relative">
      {/* Coffee/brown wallpaper blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      {/* Single rounded container (same structure as base) */}
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl">
        {/* Glossy top highlight */}
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        {/* Inner content */}
        <div className="px-6 py-10 md:px-12 md:py-14">
          <div className="mb-8 text-center">
            {status === 'authenticated' && (
              <SectionHeaders
                subHeader="our menu"
                mainHeader="Browse by Category"
              />
            )}
            {status === 'unauthenticated' && (
              <SectionHeaders
                subHeader="Feel free to browse—please sign in to place an order."
                mainHeader="You're not logged in."
              />
            )}
          </div>

          {/* Mobile: dropdown (brown focus/border) */}
          <div className="mb-6 md:hidden">
            <label htmlFor="category" className="sr-only">
              Category
            </label>
            <select
              id="category"
              className="w-full rounded-xl border border-[#B08B62]/60 bg-white/80 px-4 py-2 text-zinc-700 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#8B5E34]/60"
              value={selectedCategoryId || ''}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              disabled={loading || categories.length === 0}
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {/* Sidebar (desktop) */}
            <aside className="md:col-span-3">
              <div className="sticky top-6 hidden md:block">
                <div className="rounded-2xl border border-white/30 bg-white/60 p-3 backdrop-blur-xl">
                  <h3 className="px-2 pb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">
                    Categories
                  </h3>
                  <ul className="space-y-1">
                    {categories.map((c) => {
                      const active = c._id === selectedCategoryId;
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
                              'block w-full select-none text-left rounded-xl px-3 py-4 outline-none transition cursor-pointer',
                              'focus-visible:ring-2 focus-visible:ring-[#8B5E34]/50 focus-visible:ring-offset-0',
                              active
                                ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white shadow-lg shadow-[#A5724A]/25'
                                : 'text-zinc-700 hover:bg-white/80',
                            ].join(' ')}
                            aria-pressed={active}
                            aria-controls={`panel-${c._id}`}
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

            {/* Main content */}
            <main className="md:col-span-9">
              {loading && categories.length === 0 ? (
                <div className="text-center text-gray-500">
                  Loading menu…
                </div>
              ) : (
                <>
                  <div className="mb-4 text-center md:text-left">
                    {currentCategory ? (
                      <SectionHeaders mainHeader={currentCategory.name} />
                    ) : (
                      <SectionHeaders mainHeader="Select a category" />
                    )}
                  </div>

                  {itemsForSelected.length > 0 ? (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {itemsForSelected.map((item) => (
                        <MenuItem key={item._id} {...item} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#B08B62]/50 bg-white/60 p-8 text-center text-zinc-600 backdrop-blur-md">
                      No items in this category yet.
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </div>
    </section>
  );
}