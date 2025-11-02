// src/app/components/layout/FloatingCart.js
'use client';

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { CartContext, cartProductPrice } from '../AppContext';

const peso = (n = 0) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n || 0));

const cartKey = (p) => {
  const baseId = p._id || p.id || p.slug || p.name;
  const size = p.size?.name || null;
  const extras = (p.extras || []).map((e) => e._id || e.name).sort().join('|');
  return JSON.stringify({ baseId, size, extras });
};

export default function FloatingCart() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession(); // ← check who’s logged in

  const { cartProducts, removeCartProduct } = useContext(CartContext);
  const [open, setOpen] = useState(false);
  const prevLen = useRef(cartProducts?.length || 0);

  // Open mini-cart automatically when a new item is added
  useEffect(() => {
    const len = cartProducts?.length || 0;
    if (len > prevLen.current) setOpen(true);
    prevLen.current = len;
  }, [cartProducts]);

  // Group identical items for display/qty
  const groups = useMemo(() => {
    const map = new Map();
    (cartProducts || []).forEach((p, idx) => {
      const k = cartKey(p);
      const g = map.get(k);
      if (g) {
        g.qty += 1;
        g.indexes.push(idx);
      } else {
        map.set(k, { key: k, sample: p, qty: 1, indexes: [idx] });
      }
    });
    return Array.from(map.values());
  }, [cartProducts]);

  const itemCount = cartProducts?.length || 0;
  const subtotal = groups.reduce((s, g) => s + cartProductPrice(g.sample) * g.qty, 0);

  // Only show for authenticated customers and not on /cart page
  const isCustomer = status === 'authenticated' && session?.user?.role === 'customer';
  const hidden = pathname?.startsWith('/cart') || !isCustomer;

  const goCheckout = () => {
    setOpen(false);
    router.push('/cart');
  };

  const removeOne = (g) => {
    const idx = g.indexes[g.indexes.length - 1];
    if (typeof idx === 'number') removeCartProduct(idx);
  };

  if (hidden) return null; // safe (all hooks above have run)

  return (
    <>
      {/* Floating button */}
      <span
        type="button"
        aria-label="Open cart"
        onClick={() => setOpen(true)}
        className="print:hidden fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-full px-4 py-2 shadow-lg shadow-black/10 cursor-pointer
                   bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 4h-2l-1 2h2l3.6 7.59-1.35 2.45A1.994 1.994 0 0 0 10 19h9v-2h-8.42c-.14 0-.25-.11-.25-.25l.03-.12L11.1 14h5.45a2 2 0 0 0 1.79-1.11l3.58-6.49A1 1 0 0 0 21 5H7zM7 20a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 .001 3.999A2 2 0 0 0 17 20z"/>
        </svg>
        <span className="text-sm font-semibold">Cart</span>
        <span className="ml-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-[#7A4E2A]">
          {itemCount}
        </span>
      </span>

      {/* Overlay + panel */}
      {open && (
        <div
          className="print:hidden fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute right-3 bottom-3 top-3 w-[min(92vw,420px)] rounded-2xl border border-white/30 bg-white/90 p-4 shadow-2xl backdrop-blur-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your cart</h3>
              <span
                type="button"
                className="rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </span>
            </header>

            <div className="mt-3 grow overflow-auto space-y-3">
              {groups.length === 0 ? (
                <div className="text-center text-zinc-500 py-12">Your cart is empty</div>
              ) : (
                groups.map((g) => {
                  const p = g.sample;
                  const unit = cartProductPrice(p);
                  return (
                    <div key={g.key} className="rounded-xl border border-white/50 bg-white/70 p-3 flex gap-3">
                      <div className="w-16 h-16 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                        {p.image ? (
                          <Image src={p.image} alt={p.name || ''} width={128} height={128} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 grow">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-semibold">{p.name}</div>
                          <div className="text-sm font-medium">{peso(unit)}</div>
                        </div>
                        {p.size?.name && (
                          <div className="text-xs text-zinc-600">Size: {p.size.name}</div>
                        )}
                        {Array.isArray(p.extras) && p.extras.length > 0 && (
                          <div className="mt-1 text-xs text-zinc-600">
                            Extras: {p.extras.map((ex) => ex.name).join(', ')}
                          </div>
                        )}
                        <div className="mt-1 flex items-center justify-between">
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-zinc-700">
                            Qty: <strong className="ml-1">{g.qty}</strong>
                          </span>
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                            onClick={() => removeOne(g)}
                          >
                            Remove 1
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <footer className="pt-3 border-t border-white/60">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-zinc-600">Subtotal</span>
                <span className="font-semibold">{peso(subtotal)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="w-1/2 rounded-full border px-4 py-2 font-semibold text-zinc-700 hover:bg-white cursor-pointer"
                  onClick={() => setOpen(false)}
                >
                  Continue
                </button>
                <button
                style={{color:'white'}}
                  type="button"
                  className="w-1/2 rounded-full bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-4 py-2 font-semibold text-white shadow-sm cursor-pointer"
                  onClick={goCheckout}
                >
                  Checkout
                </button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
