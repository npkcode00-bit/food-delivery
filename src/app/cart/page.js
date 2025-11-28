// app/cart/page.jsx
'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

import { CartContext, cartProductPrice } from '../components/AppContext';
import AddressInputs from '../components/layout/AddressInputs';
import SectionHeaders from '../components/layout/SectionHeaders';
import CartProduct from '../components/menu/CartProduct';

const peso = (n = 0) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    Number(n || 0)
  );

function cartKey(p) {
  const baseId = p._id || p.id || p.slug || p.name;
  const size = p.size?.name || null;
  const extras = (p.extras || []).map((e) => e._id || e.name).sort().join('|');
  return JSON.stringify({ baseId, size, extras });
}

// Normalize PH mobile number to 10 digits starting with 9 (local part)
function normalizePhPhone(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');

  // 09123... => 9123...
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // If longer than 10, keep last 10 digits
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  // Ideally 10 digits starting with 9
  if (digits.length === 10 && digits.startsWith('9')) {
    return digits;
  }

  return digits;
}

export default function CartPage() {
  const { cartProducts = [], addToCart, removeCartProduct, clearCart } =
    useContext(CartContext);

  const { data: session } = useSession();

  const [address, setAddress] = useState({
    phone: '',
    streetAddress: '',
    barangay: '',
    city: 'San Mateo',
    province: 'Rizal',
    country: 'Philippines',
    orderMethod: 'pickup',
  });

  // Handle success/cancel + clear-cart
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (url.includes('canceled=1')) {
      toast.error('Payment failed 😔');
    }
    if (url.includes('clear-cart=1') || url.includes('success=1')) {
      clearCart();
      toast.success('Payment successful! Thank you for your order.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [clearCart]);

  // Load & save address locally with migration for old format
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('checkoutAddress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        let orderMethod = parsed.orderMethod;
        if (!orderMethod && parsed.fulfillment) {
          orderMethod =
            parsed.fulfillment === 'dinein'
              ? 'dine_in'
              : parsed.fulfillment;
        }

        // ✅ MIGRATION: If streetAddress contains commas, it's the old format
        // Try to parse it back into components
        let migratedStreet = parsed.streetAddress || '';
        let migratedBarangay = parsed.barangay || '';

        if (migratedStreet && migratedStreet.includes(',')) {
          // Old format: "street, barangay, city, province"
          const parts = migratedStreet.split(',').map(p => p.trim());
          migratedStreet = parts[0] || '';
          migratedBarangay = parts[1] || migratedBarangay;
        }

        setAddress((prev) => ({
          ...prev,
          ...parsed,
          streetAddress: migratedStreet,
          barangay: migratedBarangay,
          ...(orderMethod ? { orderMethod } : {}),
        }));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('checkoutAddress', JSON.stringify(address));
  }, [address]);

  // Prefill from profile (phone + address) if not already set
  useEffect(() => {
    if (!session) return;
    const u = session.user || {};

    const rawProfilePhone = u.phone || '';
    const normalizedPhone = normalizePhPhone(rawProfilePhone);

    setAddress((prev) => {
      const next = { ...prev };

      // Phone: only prefill if empty
      if (!prev.phone && normalizedPhone) {
        next.phone = normalizedPhone;
      }

      // Street: only prefill if empty
      if (!prev.streetAddress && u.street) {
        next.streetAddress = u.street;
      }

      // Barangay: prefill separately
      if (!prev.barangay && u.barangay) {
        next.barangay = u.barangay;
      }

      // City / Province defaults
      if (!prev.city) {
        next.city = u.city || 'San Mateo';
      }
      if (!prev.province) {
        next.province = u.province || 'Rizal';
      }

      return next;
    });
  }, [session]);

  // Group identical items
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

  // Totals
  const DELIVERY_FEE_PHP = 50;
  const subtotal =
    groups.reduce(
      (s, g) => s + cartProductPrice(g.sample) * g.qty,
      0
    ) || 0;
  const deliveryFee = address.orderMethod === 'delivery' ? DELIVERY_FEE_PHP : 0;
  const grandTotal = subtotal + deliveryFee;

  const setAddressProp = (propName, value) =>
    setAddress((prev) => ({ ...prev, [propName]: value }));

  const increaseQty = (group) => {
    const p = group.sample;
    addToCart(p, p.size, p.extras || []);
  };

  const decreaseQty = (group) => {
    const idx = group.indexes[group.indexes.length - 1];
    if (typeof idx === 'number') removeCartProduct(idx);
  };

  const editOneInGroup = (group, newSize, newExtras) => {
    const idx = group.indexes[group.indexes.length - 1];
    if (typeof idx === 'number') {
      removeCartProduct(idx);
      addToCart(group.sample, newSize, newExtras || []);
    }
  };

  async function proceedToCheckout(ev) {
    ev.preventDefault();

    if (!address.phone?.trim()) {
      return toast.error('Phone number is required');
    }

    if (address.orderMethod === 'delivery') {
      if (!address.streetAddress?.trim())
        return toast.error('Street address is required');
      if (!address.barangay?.trim())
        return toast.error('Barangay is required');
      if (!address.city?.trim()) return toast.error('City is required');
      if (!address.country?.trim())
        return toast.error('Country is required');
    }

    const promise = new Promise((resolve, reject) => {
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          cartProducts,
          orderMethod: address.orderMethod,
        }),
      })
        .then(async (response) => {
          if (!response.ok) return reject();
          const url = await response.json();
          resolve();
          window.location = url;
        })
        .catch(reject);
    });

    await toast.promise(promise, {
      loading: 'Preparing your order...',
      success: 'Redirecting to payment...',
      error: 'Something went wrong... Please try again later',
    });
  }

  if (!cartProducts?.length) {
    return (
      <section className="max-w-7xl mx-auto mt-8 text-center">
        <SectionHeaders mainHeader="Cart" />
        <p className="mt-4">Your shopping cart is empty 😔</p>
      </section>
    );
  }

  return (
    <section className="relative max-w-7xl mx-auto mt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="text-center">
        <SectionHeaders mainHeader="Cart" />
      </div>

      <div className="mt-8 grid gap-8 grid-cols-1 sm:grid-cols-2">
        <div>
          {groups.map((g) => {
            const itemTotal = cartProductPrice(g.sample) * g.qty;
            return (
              <CartProduct
                key={g.key}
                product={g.sample}
                qty={g.qty}
                lineTotal={itemTotal}
                onIncrease={() => increaseQty(g)}
                onDecrease={() => decreaseQty(g)}
                onEdit={(newSize, newExtras) =>
                  editOneInGroup(g, newSize, newExtras)
                }
              />
            );
          })}

          <div className="py-2 pr-16 flex justify-end items-center">
            <div className="text-gray-500">
              Subtotal:
              <br />
              {address.orderMethod === 'delivery' ? 'Delivery:' : 'Service:'}
              <br />
              Total:
            </div>
            <div className="font-semibold pl-2 text-right">
              {peso(subtotal)}
              <br />
              {peso(deliveryFee)}
              <br />
              {peso(grandTotal)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/30 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
          <h2 className="text-center font-semibold uppercase mb-5">
            Checkout
          </h2>
          <form onSubmit={proceedToCheckout}>
            <AddressInputs
              addressProps={address}
              setAddressProp={setAddressProp}
              hideAddress={address.orderMethod !== 'delivery'}
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-full px-5 py-2.5 font-semibold text-white shadow-md shadow-[#A5724A]/20 hover:shadow-[#A5724A]/40 cursor-pointer bg-gradient-to-r from-[#A5724A] to-[#7A4E2A]"
            >
              Pay {peso(grandTotal)}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}