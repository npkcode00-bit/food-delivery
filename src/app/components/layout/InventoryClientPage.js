// src/app/inventory/InventoryClientPage.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

export default function InventoryClientPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // create form
  const [form, setForm] = useState({
    name: '',
    category: '',
    notes: '',
    variants: [{ name: '', unit: 'pcs', stock: 0, lowStockThreshold: 0 }],
  });

  // search & modal
  const [q, setQ] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  // accordion open state
  const [openIds, setOpenIds] = useState(() => new Set());

  const toggleOpen = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load inventory: ${res.status}`);
      const data = await res.json();
      setItems(data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const addVariantRow = () => {
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { name: '', unit: 'pcs', stock: 0, lowStockThreshold: 0 }],
    }));
  };

  const updateVariant = (idx, key, value) => {
    setForm((f) => {
      const v = [...f.variants];
      v[idx] = {
        ...v[idx],
        [key]: key === 'stock' || key === 'lowStockThreshold' ? Number(value) : value,
      };
      return { ...f, variants: v };
    });
  };

  const createItem = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.category.trim()) {
      toast.error('Name and Category are required');
      return;
    }

    const cleanedVariants = (form.variants || [])
      .map((v) => ({
        name: (v.name || '').trim(),
        unit: (v.unit || 'pcs').trim(),
        stock: Number(v.stock || 0),
        lowStockThreshold: Number(v.lowStockThreshold || 0),
      }))
      .filter((v) => v.name.length > 0);

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      notes: (form.notes || '').trim(),
      variants: cleanedVariants,
    };

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error('Create failed:', res.status, t);
        throw new Error(t || 'Create failed');
      }
      toast.success('Item created');
      setForm({
        name: '',
        category: '',
        notes: '',
        variants: [{ name: '', unit: 'pcs', stock: 0, lowStockThreshold: 0 }],
      });
      fetchItems();
    } catch (e) {
      console.error(e);
      toast.error('Create failed');
    }
  };

  const deleteItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Deleted');
      fetchItems();
    } catch (e) {
      console.error(e);
      toast.error('Delete failed');
    }
  };

  // ====== EDIT MODAL ======
  const openEdit = (item) => {
    setEditItem(JSON.parse(JSON.stringify(item))); // deep copy
    setEditOpen(true);
  };

  const addEditVariant = () => {
    setEditItem((it) => ({
      ...it,
      variants: [...(it.variants || []), { name: '', unit: 'pcs', stock: 0, lowStockThreshold: 0 }],
    }));
  };

  const removeEditVariant = (idx) => {
    setEditItem((it) => ({
      ...it,
      variants: (it.variants || []).filter((_, i) => i !== idx),
    }));
  };

  const updateEditVariant = (idx, key, val) => {
    setEditItem((it) => {
      const v = [...(it.variants || [])];
      v[idx] = {
        ...v[idx],
        [key]: key === 'stock' || key === 'lowStockThreshold' ? Number(val) : val,
      };
      return { ...it, variants: v };
    });
  };

  const saveEdit = async () => {
    if (!editItem) return;
    try {
      const payload = {
        name: (editItem.name || '').trim(),
        category: (editItem.category || '').trim(),
        notes: (editItem.notes || '').trim(),
        variants: (editItem.variants || [])
          .map((v) => ({
            _id: v._id, // keep if present
            name: (v.name || '').trim(),
            unit: (v.unit || 'pcs').trim(),
            stock: Number(v.stock || 0),
            lowStockThreshold: Number(v.lowStockThreshold || 0),
          }))
          .filter((v) => v.name.length),
      };

      if (!payload.name || !payload.category) {
        toast.error('Name and Category are required');
        return;
      }

      const res = await fetch(`/api/inventory/${editItem._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error('Update failed:', res.status, t);
        throw new Error(t || 'Update failed');
      }
      toast.success('Updated');
      setEditOpen(false);
      setEditItem(null);
      fetchItems();
    } catch (e) {
      console.error(e);
      toast.error('Update failed');
    }
  };

  // ====== FILTERED VIEW ======
  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((it) => {
      if (it.name?.toLowerCase().includes(s)) return true;
      if (it.category?.toLowerCase().includes(s)) return true;
      if (it.notes?.toLowerCase().includes(s)) return true;
      if (Array.isArray(it.variants)) {
        return it.variants.some((v) => v.name?.toLowerCase().includes(s));
      }
      return false;
    });
  }, [items, q]);

  return (
    <section className="relative">
      {/* soft brown blurred wallpaper */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-14">
        <h1 className="text-2xl font-semibold text-zinc-900">Inventory</h1>

        {/* mac-style window card */}
        <div className="mt-6 rounded-2xl border border-white/30 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
          {/* Create item */}
          <form onSubmit={createItem} className="rounded-xl border border-white/40 bg-white/70 p-4 md:p-5 backdrop-blur-md">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                className="rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                placeholder="Item name (e.g., plastic caps)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                placeholder="Category (e.g., packaging)"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <input
                className="rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="mt-4 space-y-2">
              <div className="font-semibold text-zinc-800">Variants</div>
              {form.variants.map((v, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input
                    className="col-span-6 md:col-span-5 rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                    placeholder="Variant name (e.g., Small / per sack)"
                    value={v.name}
                    onChange={(e) => updateVariant(i, 'name', e.target.value)}
                  />
                  <input
                    className="col-span-3 md:col-span-3 rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                    placeholder="Unit (pcs, sack, kg)"
                    value={v.unit}
                    onChange={(e) => updateVariant(i, 'unit', e.target.value)}
                  />
                  <input
                    type="number"
                    className="col-span-3 md:col-span-4 rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                    placeholder="Stock"
                    value={v.stock}
                    onChange={(e) => updateVariant(i, 'stock', e.target.value)}
                  />
                </div>
              ))}
              <button
                type="button"
                className="cursor-pointer rounded-full border border-[#B08B62]/50 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60"
                onClick={addVariantRow}
              >
                + Add variant
              </button>
            </div>

            <div className="mt-4">
              <button
                className="cursor-pointer inline-flex items-center justify-center rounded-full border border-white/30 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2.5 !text-white shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60"
              >
                Create
              </button>
            </div>
          </form>

          {/* Search bar */}
          <div className="mt-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items, categories, notes, or variants…"
              className="w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30 sm:w-96"
            />
            <div className="text-sm text-zinc-600">
              {filtered.length} result{filtered.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Accordion list (dropdown table) */}
          <div className="mt-4 divide-y divide-white/40 rounded-xl border border-white/40 bg-white/70 backdrop-blur-md">
            {loading ? (
              <div className="py-8 text-center text-zinc-500">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">No items match your search.</div>
            ) : (
              filtered.map((item) => {
                const hasLow =
                  Array.isArray(item.variants) &&
                  item.variants.some(
                    (v) =>
                      typeof v?.lowStockThreshold === 'number' &&
                      Number(v.stock) <= Number(v.lowStockThreshold)
                  );
                const open = openIds.has(item._id);
                const count = item.variants?.length || 0;

                return (
                  <div key={item._id} className="group">
                    {/* Header row */}
                    <div
                      className="flex cursor-pointer items-center gap-3 px-4 py-4 hover:bg-white/80"
                      onClick={() => toggleOpen(item._id)}
                      aria-expanded={open}
                    >
                      <span
                        className={[
                          'grid h-6 w-6 place-items-center rounded-full border text-xs font-bold transition',
                          open
                            ? 'border-[#7A4E2A] bg-[#A5724A] !text-white'
                            : 'border-zinc-300 bg-white text-zinc-700',
                        ].join(' ')}
                      >
                        {open ? '−' : '+'}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-semibold text-zinc-900">{item.name}</div>
                          <span className="rounded-full border border-[#B08B62]/40 bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-700">
                            {item.category || '—'}
                          </span>
                          {count > 0 && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                              {count} variant{count > 1 ? 's' : ''}
                            </span>
                          )}
                          {hasLow && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              Low stock
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="mt-1 line-clamp-1 text-sm text-zinc-500">{item.notes}</div>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1 text-sm font-semibold text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(item._id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Dropdown content */}
                    {open && (
                      <div className="px-4 pb-4">
                        <div className="overflow-x-auto rounded-xl border border-white/40">
                          <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-700">
                              <tr className="[&>th]:py-2.5 [&>th]:px-3 border-b border-zinc-200">
                                <th className="text-left">Variant</th>
                                <th className="text-left w-28">Unit</th>
                                <th className="text-right w-28">Stock</th>
                                <th className="text-right w-40">Low threshold</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {(item.variants?.length ? item.variants : [{ name: '—', unit: '—', stock: '—' }]).map(
                                (v, i) => {
                                  const low =
                                    v &&
                                    typeof v.lowStockThreshold === 'number' &&
                                    Number(v.stock) <= Number(v.lowStockThreshold);
                                  return (
                                    <tr key={v?._id || i} className="[&>td]:py-2.5 [&>td]:px-3">
                                      <td className="text-zinc-900">{v?.name ?? '—'}</td>
                                      <td className="text-zinc-700">{v?.unit ?? '—'}</td>
                                      <td className={`text-right ${low ? 'text-amber-700 font-semibold' : 'text-zinc-800'}`}>
                                        {v?.stock ?? '—'}
                                      </td>
                                      <td className="text-right text-zinc-500">{v?.lowStockThreshold ?? '—'}</td>
                                    </tr>
                                  );
                                }
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editOpen && editItem && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/30 bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-lg font-semibold">Edit Item</h3>
              <button
                className="cursor-pointer rounded-md p-2 text-zinc-600 hover:bg-zinc-100"
                onClick={() => {
                  setEditOpen(false);
                  setEditItem(null);
                }}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  className="rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                  placeholder="Item name"
                  value={editItem.name || ''}
                  onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                />
                <input
                  className="rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                  placeholder="Category"
                  value={editItem.category || ''}
                  onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
                />
                <input
                  className="rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                  placeholder="Notes"
                  value={editItem.notes || ''}
                  onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
                />
              </div>

              <div>
                <div className="mb-2 font-semibold text-zinc-800">Variants</div>
                <div className="space-y-2">
                  {(editItem.variants || []).map((v, i) => (
                    <div key={v._id || i} className="grid grid-cols-12 items-start gap-2">
                      <input
                        className="col-span-5 rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                        placeholder="Variant name"
                        value={v.name || ''}
                        onChange={(e) => updateEditVariant(i, 'name', e.target.value)}
                      />
                      <input
                        className="col-span-3 rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                        placeholder="Unit"
                        value={v.unit || ''}
                        onChange={(e) => updateEditVariant(i, 'unit', e.target.value)}
                      />
                      <input
                        type="number"
                        className="col-span-3 rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 outline-none placeholder:text-zinc-400 focus:border-[#A5724A] focus:ring-2 focus:ring-[#8B5E34]/30"
                        placeholder="Stock"
                        value={v.stock ?? 0}
                        onChange={(e) => updateEditVariant(i, 'stock', e.target.value)}
                      />
                      <button
                        type="button"
                        className="col-span-1 cursor-pointer rounded-md border border-red-300 py-2 text-red-600 hover:bg-red-50"
                        onClick={() => removeEditVariant(i)}
                        title="Remove variant"
                        aria-label="Remove variant"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 cursor-pointer rounded-full border border-[#B08B62]/50 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60"
                  onClick={addEditVariant}
                >
                  + Add variant
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="cursor-pointer rounded-md border border-zinc-300 bg-white px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
                onClick={() => {
                  setEditOpen(false);
                  setEditItem(null);
                }}
              >
                Cancel
              </button>
              <button
                className="cursor-pointer inline-flex items-center justify-center rounded-full border border-white/30 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2.5 !text-white shadow-md shadow-[#A5724A]/20 transition hover:shadow-[#A5724A]/40"
                onClick={saveEdit}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
