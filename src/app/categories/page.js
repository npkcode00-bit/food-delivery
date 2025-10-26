// app/categories/page.jsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import UserTabs from '../components/layout/UserTabs';
import DeleteButton from '../components/DeleteButton';

export default function CategoriesPage() {
  const { data: session, status } = useSession();
  const isAdmin = !!session?.user?.admin;

  const [categoryName, setCategoryName] = useState('');
  const [categories, setCategories] = useState([]);
  const [editedCategory, setEditedCategory] = useState(null);

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      fetchCategories();
    }
  }, [status, isAdmin]);

  function fetchCategories() {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((cats) => setCategories(cats))
      .catch(() => toast.error('Failed to load categories'));
  }

  async function handleCategorySubmit(ev) {
    ev.preventDefault();

    if (!categoryName || categoryName.trim() === '') {
      toast.error('Category name cannot be empty');
      return;
    }

    const creationPromise = new Promise(async (resolve, reject) => {
      try {
        const data = { name: categoryName.trim() };
        if (editedCategory) data._id = editedCategory._id;

        const response = await fetch('/api/categories', {
          method: editedCategory ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Request failed');

        setCategoryName('');
        setEditedCategory(null);
        fetchCategories();
        resolve();
      } catch {
        reject();
      }
    });

    await toast.promise(creationPromise, {
      loading: editedCategory ? 'Updating category...' : 'Creating your new category...',
      success: editedCategory ? 'Category updated' : 'Category created',
      error: 'Error, sorry...',
    });
  }

  async function handleDeleteClick(_id) {
    const promise = new Promise(async (resolve, reject) => {
      try {
        const response = await fetch('/api/categories?_id=' + _id, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete failed');
        resolve();
      } catch {
        reject();
      }
    });

    await toast.promise(promise, {
      loading: 'Deleting...',
      success: 'Deleted',
      error: 'Error',
    });

    fetchCategories();
  }

  if (status === 'loading') return 'Loading ...';
  if (status === 'unauthenticated') return 'Please log in';
  if (!isAdmin) return 'Not an admin';

  return (
    <section className="relative">
      {/* soft brown blurred background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl">
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        <div className="px-6 py-10 md:px-12 md:py-14">
          <UserTabs isAdmin={isAdmin} />

          <h1 className="mt-6 mb-4 text-xl font-semibold text-zinc-900">Categories</h1>

          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Sidebar */}
            <aside className="md:col-span-4">
              {/* Mobile chips */}
              <div className="-mx-2 mb-4 overflow-x-auto md:hidden no-scrollbar">
                <ul className="flex gap-2 px-2 whitespace-nowrap">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setEditedCategory(null);
                        setCategoryName('');
                      }}
                      className="cursor-pointer rounded-full border border-[#B08B62]/50 bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-white"
                      title="Create new category"
                    >
                      ➕ New
                    </button>
                  </li>

                  {categories.map((c) => {
                    const isActive = editedCategory?._id === c._id;
                    return (
                      <li key={c._id} className="inline-block">
                        <button
                          type="button"
                          onClick={() => {
                            setEditedCategory(c);
                            setCategoryName(c.name);
                          }}
                          className={[
                            'cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition',
                            isActive
                              ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] !text-white shadow-md shadow-[#A5724A]/25'
                              : 'border border-[#B08B62]/50 bg-white/90 !text-zinc-700 hover:bg-white',
                          ].join(' ')}
                        >
                          {c.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Desktop: vertical list */}
              <div className="sticky top-6 hidden md:block">
                <div className="rounded-2xl border border-white/30 bg-white/60 p-3 backdrop-blur-xl">
                  <div className="px-2 pb-2 grid items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
                      All categories
                    </h3>
                  </div>

                  <ul className="space-y-1">
                    {categories.length === 0 && (
                      <li className="px-3 py-3 text-sm text-zinc-500">No categories yet</li>
                    )}

                    {categories.map((c) => {
                      const isActive = editedCategory?._id === c._id;

                      return (
                        <li key={c._id}>
                          <div
                            className={[
                              'grid items-center gap-2 rounded-xl px-3 py-3 transition',
                              isActive
                                ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white shadow-lg shadow-[#A5724A]/25'
                                : 'hover:bg-white/80 text-zinc-700',
                            ].join(' ')}
                          >
                            {/* Category name button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditedCategory(c);
                                setCategoryName(c.name);
                              }}
                              className={[
                                'cursor-pointer flex-1 text-left outline-none',
                                isActive ? '!text-white' : '!text-zinc-800',
                              ].join(' ')}
                              title="Select"
                            >
                              {c.name}
                            </button>

                            <div className="pl-1 flex gap-2">
                              {/* Edit chip */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditedCategory(c);
                                  setCategoryName(c.name);
                                }}
                                className={[
                                  'cursor-pointer rounded-md px-2 py-1 text-xs font-semibold transition',
                                  isActive
                                    ? 'bg-white/20 !text-white hover:!bg-white/25'
                                    : '!text-zinc-600 hover:bg-white/70',
                                ].join(' ')}
                                title="Edit"
                              >
                                Edit
                              </button>

                              <DeleteButton
                                label="Delete"
                                onDelete={() => handleDeleteClick(c._id)}
                                variant={isActive ? 'light' : 'danger'}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 px-2">
                    <button
                      type="button"
                      onClick={fetchCategories}
                      className="cursor-pointer w-full rounded-xl border border-[#B08B62]/50 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5E34]/50"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="md:col-span-8">
              <div className="rounded-2xl border border-white/30 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
                <form onSubmit={handleCategorySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      {editedCategory ? (
                        <>
                          Update category:&nbsp;<b className="font-semibold">{editedCategory.name}</b>
                        </>
                      ) : (
                        'New category name'
                      )}
                    </label>
                    <input
                      type="text"
                      value={categoryName}
                      onChange={(ev) => setCategoryName(ev.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-4 py-2 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/40"
                      placeholder="e.g. Hot Coffee"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      className="cursor-pointer inline-flex items-center justify-center rounded-full border border-white/30 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2.5 text-white shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60 w-full sm:w-auto"
                    >
                      {editedCategory ? 'Update' : 'Create'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditedCategory(null);
                        setCategoryName('');
                      }}
                      className="cursor-pointer inline-flex items-center justify-center rounded-full border border-[#B08B62]/50 bg-white/80 px-5 py-2.5 font-semibold text-zinc-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60 w-full sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </form>

                {/* Mobile compact list */}
                <div className="mt-8 md:hidden">
                  <h2 className="text-sm uppercase tracking-wide text-zinc-600">Existing categories</h2>
                  <div className="mt-3 space-y-2">
                    {categories?.length > 0 ? (
                      categories.map((c) => {
                        const isActive = editedCategory?._id === c._id;
                        return (
                          <div
                            key={c._id}
                            className="flex items-center justify-between rounded-xl border border-white/30 bg-white/70 px-4 py-3 backdrop-blur-md"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setEditedCategory(c);
                                setCategoryName(c.name);
                              }}
                              className="cursor-pointer font-medium !text-zinc-800 text-left"
                              title="Edit"
                            >
                              {c.name}
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditedCategory(c);
                                  setCategoryName(c.name);
                                }}
                                className="cursor-pointer rounded-md px-3 py-1 text-xs font-semibold !text-zinc-700 hover:bg-white/90"
                              >
                                Edit
                              </button>
                              <DeleteButton
                                label="Delete"
                                onDelete={() => handleDeleteClick(c._id)}
                                variant={isActive ? 'light' : 'danger'}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-zinc-300/70 bg-white/70 p-6 text-center text-zinc-500">
                        No categories yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* hide mobile scrollbar on the chip row */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </section>
  );
}
