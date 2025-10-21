// src/app/inventory/InventoryClientPage.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

export default function InventoryClientPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // create form (kept as-is)
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
    <section className="max-w-6xl mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">Inventory</h1>

      {/* ---------------- Create item (unchanged UI) ---------------- */}
      <form onSubmit={createItem} className="border rounded-lg p-4 mb-8 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Item name (e.g., plastic caps)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="border rounded p-2"
            placeholder="Category (e.g., packaging)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <input
            className="border rounded p-2"
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <div className="font-semibold">Variants</div>
          {form.variants.map((v, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input
                className="col-span-5 md:col-span-5 border rounded p-2"
                placeholder="Variant name (e.g., small, per sack)"
                value={v.name}
                onChange={(e) => updateVariant(i, 'name', e.target.value)}
              />
              <input
                className="col-span-3 md:col-span-3 border rounded p-2"
                placeholder="Unit (pcs, sack, kg, plate)"
                value={v.unit}
                onChange={(e) => updateVariant(i, 'unit', e.target.value)}
              />
              <input
                type="number"
                className="col-span-4 md:col-span-4 border rounded p-2"
                placeholder="Stock"
                value={v.stock}
                onChange={(e) => updateVariant(i, 'stock', e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            className="border rounded p-2 cursor-pointer"
            onClick={addVariantRow}
          >
            + Add variant
          </button>
        </div>

        <button style={{color:'white'}} className="bg-black text-white rounded px-4 py-2 cursor-pointer">
          Create
        </button>
      </form>

      {/* ---------------- Table header / search ---------------- */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search items, categories, notes, or variants…"
          className="w-full md:w-96 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <div className="text-sm text-slate-500">
          {filtered.length} result{filtered.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* ---------------- mac-style table ---------------- */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 sticky top-0">
              <tr className="[&>th]:py-3 [&>th]:px-3 border-b border-slate-200">
                <th className="text-left w-48">Item</th>
                <th className="text-left w-36">Category</th>
                <th className="text-left w-40">Variant</th>
                <th className="text-left w-24">Unit</th>
                <th className="text-right w-24">Stock</th>
                <th className="text-left">Notes</th>
                <th className="text-right w-[200px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No items match your search.
                  </td>
                </tr>
              ) : (
                filtered.flatMap((item, idx) => {
                  const rows = item.variants?.length ? item.variants : [null];
                  return rows.map((v, i) => {
                    const low =
                      v &&
                      typeof v.lowStockThreshold === 'number' &&
                      Number(v.stock) <= Number(v.lowStockThreshold);
                    return (
                      <tr
                        key={`${item._id}-${v?._id || i}`}
                        className={idx % 2 === 1 ? 'bg-slate-50/50' : ''}
                      >
                        <td className="py-3 px-3 align-top">
                          <div className="font-medium text-slate-900">{item.name}</div>
                        </td>
                        <td className="py-3 px-3 align-top text-slate-700">{item.category}</td>
                        <td className="py-3 px-3 align-top">
                          {v ? v.name : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3 px-3 align-top">
                          {v ? v.unit : <span className="text-slate-400">—</span>}
                        </td>
                        <td
                          className={`py-3 px-3 align-top text-right ${
                            low ? 'text-amber-600 font-semibold' : ''
                          }`}
                        >
                          {v ? v.stock : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3 px-3 align-top text-slate-500">
                          {i === 0 ? item.notes : ''}
                        </td>
                        <td className="py-3 px-3 align-top">
                          {/* Item-level controls only once per item (first row) */}
                          {i === 0 && (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                className="border border-slate-300 rounded-md px-3 py-1 hover:bg-slate-50 cursor-pointer"
                                onClick={() => openEdit(item)}
                              >
                                Edit
                              </button>
                              <button
                                className="border border-red-300 text-red-600 rounded-md px-3 py-1 hover:bg-red-50 cursor-pointer"
                                onClick={() => deleteItem(item._id)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- EDIT MODAL ---------------- */}
      {editOpen && editItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200">
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Edit Item</h3>
              <button
              style={{maxWidth:'100px'}}
                className="rounded-md p-2 hover:bg-slate-100 text-slate-600 cursor-pointer"
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
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="border rounded p-2"
                  placeholder="Item name"
                  value={editItem.name || ''}
                  onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                />
                <input
                  className="border rounded p-2"
                  placeholder="Category"
                  value={editItem.category || ''}
                  onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
                />
                <input
                  className="border rounded p-2"
                  placeholder="Notes"
                  value={editItem.notes || ''}
                  onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
                />
              </div>

              <div>
                <div className="font-semibold mb-2">Variants</div>
                <div className="space-y-2">
                  {(editItem.variants || []).map((v, i) => (
                    <div key={v._id || i} className="grid grid-cols-12 gap-2 items-start">
                      <input
                        className="col-span-4 border rounded p-2"
                        placeholder="Variant name"
                        value={v.name || ''}
                        onChange={(e) => updateEditVariant(i, 'name', e.target.value)}
                      />
                      <input
                        className="col-span-2 border rounded p-2"
                        placeholder="Unit"
                        value={v.unit || ''}
                        onChange={(e) => updateEditVariant(i, 'unit', e.target.value)}
                      />
                      <input
                        type="number"
                        className="col-span-2 border rounded p-2"
                        placeholder="Stock"
                        value={v.stock ?? 0}
                        onChange={(e) => updateEditVariant(i, 'stock', e.target.value)}
                      />
                      <button
                      style={{padding:'10px'}}
                        type="button"
                        className="border border-red-300 text-red-600 rounded-md py-2 hover:bg-red-50 cursor-pointer"
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
                  className="mt-2 border rounded p-2 cursor-pointer hover:bg-slate-50"
                  onClick={addEditVariant}
                >
                  + Add variant
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                className="border rounded-md px-4 py-2 hover:bg-slate-50 cursor-pointer"
                onClick={() => {
                  setEditOpen(false);
                  setEditItem(null);
                }}
              >
                Cancel
              </button>
              <button
              style={{color:'white'}}
                className="bg-black text-white rounded-md px-4 py-2 cursor-pointer"
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
