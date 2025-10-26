'use client';

import Image from 'next/image';
import { useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';

import { CartContext } from '../AppContext';
import MenuItemTile from './MenuItemTile';
import FlyingButton from '../CustomFlyingButton';

/* -------------------------------- Modal (inline) -------------------------------- */
function PortalModal({ open, onClose, children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // lock/unlock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------- Component -------------------------------- */
export default function MenuItem(menuItem) {
  const {
    image,
    name,
    description,
    basePrice = 0,
    sizes = [],
    extraIngredientPrices = [],
  } = menuItem;

  const { data: session, status } = useSession();
  const role = session?.user?.role; // 'customer' | 'admin' | 'cashier' | 'accounting'
  const isCustomer = status === 'authenticated' && role === 'customer';

  const { addToCart } = useContext(CartContext);

  const [showPopup, setShowPopup] = useState(false);
  const [selectedSize, setSelectedSize] = useState(sizes?.[0] || null);
  const [selectedExtras, setSelectedExtras] = useState([]);

  const peso = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
      Number(n || 0)
    );

  const selectedPrice = useMemo(() => {
    let p = Number(basePrice || 0);
    if (selectedSize?.price) p += Number(selectedSize.price);
    for (const ex of selectedExtras) p += Number(ex?.price || 0);
    return p;
  }, [basePrice, selectedSize, selectedExtras]);

  async function handleAddToCartButtonClick() {
    if (!isCustomer) return;

    const hasOptions =
      (sizes?.length ?? 0) > 0 || (extraIngredientPrices?.length ?? 0) > 0;

    if (hasOptions && !showPopup) {
      setShowPopup(true);
      return;
    }

    addToCart(menuItem, selectedSize, selectedExtras);

    // give the FlyingButton time to animate
    await new Promise((r) => setTimeout(r, 1000));
    setShowPopup(false);
  }

  function toggleExtra(ev, extra) {
    const checked = ev.target.checked;
    const key = extra._id || extra.name;
    if (checked) {
      setSelectedExtras((prev) => [...prev, extra]);
    } else {
      setSelectedExtras((prev) => prev.filter((e) => (e._id || e.name) !== key));
    }
  }

  return (
    <>
      {/* The product card */}
      <MenuItemTile
        onAddToCart={isCustomer ? handleAddToCartButtonClick : undefined}
        {...menuItem}
      />

      {/* Options Modal */}
      <PortalModal open={showPopup} onClose={() => setShowPopup(false)}>
        <div className="max-h-[80vh] overflow-y-auto">
          {/* Header / hero */}
          <div className="p-4 pb-2">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {image && (
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={image}
                    alt={name || 'Menu item'}
                    fill
                    sizes="(max-width: 768px) 100vw, 480px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h2 className="text-center text-lg font-bold text-zinc-900">{name}</h2>
                {description && (
                  <p className="mt-1 text-center text-sm text-zinc-600">{description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sizes */}
          {sizes?.length > 0 && (
            <div className="px-4 pt-2">
              <h3 className="mb-2 text-center text-sm font-semibold text-zinc-700">
                Pick your size
              </h3>
              <div className="space-y-2">
                {sizes.map((size) => {
                  const active = selectedSize?.name === size.name;
                  const price = Number(basePrice || 0) + Number(size?.price || 0);
                  return (
                    <label
                      key={size._id || size.name}
                      className={[
                        'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition cursor-pointer',
                        active
                          ? 'border-[#A5724A] bg-amber-50/50'
                          : 'border-zinc-200 hover:bg-zinc-50',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="size"
                          className="cursor-pointer"
                          checked={active}
                          onChange={() => setSelectedSize(size)}
                        />
                        <span className="font-medium text-zinc-800">{size.name}</span>
                      </span>
                      <span className="text-sm font-semibold text-zinc-700">
                        {peso(price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extras */}
          {extraIngredientPrices?.length > 0 && (
            <div className="px-4 pt-4">
              <h3 className="mb-2 text-center text-sm font-semibold text-zinc-700">
                Any extras?
              </h3>
              <div className="space-y-2">
                {extraIngredientPrices.map((ex) => {
                  const checked = selectedExtras.some(
                    (e) => (e._id || e.name) === (ex._id || ex.name)
                  );
                  return (
                    <label
                      key={ex._id || ex.name}
                      className={[
                        'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition cursor-pointer',
                        checked
                          ? 'border-[#A5724A] bg-amber-50/50'
                          : 'border-zinc-200 hover:bg-zinc-50',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="cursor-pointer"
                          checked={checked}
                          onChange={(ev) => toggleExtra(ev, ex)}
                        />
                        <span className="font-medium text-zinc-800">{ex.name}</span>
                      </span>
                      <span className="text-sm font-semibold text-zinc-700">
                        {peso(ex.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sticky action bar */}
          <div className="sticky bottom-0 mt-5 border-t bg-white/90 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="cursor-pointer rounded-full border border-zinc-300 bg-white px-5 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>

              {isCustomer ? (
                <FlyingButton targetTop="5%" targetLeft="95%" src={image}>
                  <button
                  style={{color:'white'}}
                    type="button"
                    onClick={handleAddToCartButtonClick}
                    className="cursor-pointer inline-flex w-full items-center justify-center rounded-full border border-white/30 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-5 py-2 font-semibold text-white shadow-md shadow-[#A5724A]/20 hover:shadow-[#A5724A]/40"
                  >
                    Add to cart&nbsp;{peso(selectedPrice)}
                  </button>
                </FlyingButton>
              ) : (
                <button
                style={{color:'white'}}
                  type="button"
                  className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 px-5 py-2 font-semibold text-zinc-500"
                  disabled
                  title="Only customers can add to cart"
                >
                  Add to cart
                </button>
              )}
            </div>
          </div>
        </div>
      </PortalModal>
    </>
  );
}
