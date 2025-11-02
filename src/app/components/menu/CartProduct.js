'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { cartProductPrice } from '../AppContext';
import Trash from '../icons/Trash'; // (kept if you still want a remove button in the editor)

function peso(n = 0) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n || 0));
}

/**
 * Props:
 * - product: one sample cart product (has .image .name .size .extras and also option lists like .sizes, .extraIngredientPrices if available)
 * - qty: number (grouped quantity)
 * - lineTotal: number (price * qty)
 * - onIncrease(): add one
 * - onDecrease(): remove one
 * - onEdit(newSize, newExtras): edit one item in this group
 */
export default function CartProduct({
  product,
  qty = 1,
  lineTotal,
  onIncrease,
  onDecrease,
  onEdit,
}) {
  const [editing, setEditing] = useState(false);
  const [draftSize, setDraftSize] = useState(product.size || null);
  const [draftExtras, setDraftExtras] = useState(product.extras || []);

  const sizeOptions = product.sizes || product.sizeOptions || [];
  const extrasOptions = product.extraIngredientPrices || product.extrasOptions || [];

  // calculate unit price for current display (editing vs current)
  const unitPrice = useMemo(() => {
    const sample = editing
      ? { ...product, size: draftSize, extras: draftExtras }
      : product;
    return cartProductPrice(sample);
  }, [editing, product, draftSize, draftExtras]);

  /** toggle extra in draft */
  const toggleDraftExtra = (extra) => {
    const id = extra._id || extra.name;
    const exists = draftExtras.some((e) => (e._id || e.name) === id);
    if (exists) {
      setDraftExtras((prev) => prev.filter((e) => (e._id || e.name) !== id));
    } else {
      setDraftExtras((prev) => [...prev, extra]);
    }
  };

  const extrasChosen = product.extras || [];

  return (
    <div className="flex items-start gap-4 border-b py-4">
      <div className="w-24 shrink-0">
        <Image
          width={240}
          height={240}
          src={product.image}
          alt={product.name || 'cart product'}
          className="rounded"
        />
      </div>

      <div className="grow min-w-0">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold truncate">{product.name}</h3>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-zinc-600">
            Qty: <strong className="ml-1">{qty}</strong>
          </span>
        </div>

        {/* current selection */}
        {!editing && (
          <>
            {product.size && (
              <div className="text-sm">
                Size:&nbsp;<span className="font-medium">{product.size.name}</span>
              </div>
            )}

            {extrasChosen.length > 0 && (
              <div className="mt-1 text-sm text-gray-600">
                <div className="font-medium">Extras:</div>
                <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {extrasChosen.map((ex, i) => (
                    <li key={`${ex.name}-${i}`} className="flex justify-between">
                      <span>{ex.name}</span>
                      <span className="tabular-nums">{peso(ex.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* editor */}
        {editing && (
          <div className="mt-2 rounded-lg border bg-white/70 p-3">
            {sizeOptions.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-1">Pick your size</div>
                <div className="space-y-1">
                  {sizeOptions.map((s) => (
                    <label
                      key={s._id || s.name}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                    >
                      <input
                        className="cursor-pointer"
                        type="radio"
                        name={`size-${product._id || product.id || product.name}`}
                        checked={(draftSize?.name || '') === s.name}
                        onChange={() => setDraftSize(s)}
                      />
                      <span className="grow">{s.name}</span>
                      <span className="tabular-nums">{peso((product.basePrice || 0) + (s.price || 0))}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {extrasOptions.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium mb-1">Any extras?</div>
                <div className="space-y-1">
                  {extrasOptions.map((ex) => {
                    const id = ex._id || ex.name;
                    const checked = draftExtras.some((e) => (e._id || e.name) === id);
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2"
                      >
                        <input
                          className="cursor-pointer"
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDraftExtra(ex)}
                        />
                        <span className="grow">{ex.name}</span>
                        <span className="tabular-nums">{peso(ex.price)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-col sm:flex gap-2">
              <button
                type="button"
                className="rounded-full border px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                onClick={() => {
                  setEditing(false);
                  setDraftSize(product.size || null);
                  setDraftExtras(product.extras || []);
                }}
              >
                Cancel
              </button>
              <button
              style={{color:'white'}}
                type="button"
                className="rounded-full bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-4 py-2 text-sm font-semibold text-white shadow-sm cursor-pointer"
                onClick={() => {
                  onEdit?.(draftSize || null, draftExtras || []);
                  setEditing(false);
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        )}

        {/* controls row */}
        <div style={{justifyContent:'center'}} className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-full border">
            <button
              type="button"
              className="px-3 py-1 hover:bg-zinc-50 cursor-pointer"
              aria-label="Decrease quantity"
              onClick={onDecrease}
            >
              −
            </button>
            <span className="px-3 py-1 text-sm tabular-nums">{qty}</span>
            <button
              type="button"
              className="px-3 py-1 hover:bg-zinc-50 cursor-pointer"
              aria-label="Increase quantity"
              onClick={onIncrease}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="ml-1 rounded-full border px-3 py-1 text-sm font-semibold hover:bg-zinc-50 cursor-pointer"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Close editor' : 'Edit options'}
          </button>
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm text-zinc-500">Unit: {peso(unitPrice)}</div>
        <div className="text-lg font-semibold">{peso(lineTotal)}</div>
      </div>
    </div>
  );
}
