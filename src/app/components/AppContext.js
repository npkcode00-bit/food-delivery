'use client';

import { createContext, useEffect, useRef, useState } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

export const CartContext = createContext({});

export function cartProductPrice(cartProduct) {
  let price = cartProduct.basePrice;
  if (cartProduct.size) {
    price += cartProduct.size.price;
  }
  if (cartProduct.extras?.length > 0) {
    for (const extra of cartProduct.extras) {
      price += extra.price;
    }
  }
  return price;
}

// --- Public wrapper you use in layout ---
export function AppProvider({ children }) {
  // IMPORTANT: SessionProvider must wrap the component that calls useSession()
  return (
    <SessionProvider>
      <CartProviderInner>{children}</CartProviderInner>
    </SessionProvider>
  );
}

// --- Actual provider that reads the session and manages the cart ---
function CartProviderInner({ children }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || 'guest';
  const STORAGE_KEY = `cart:${userId}`;
  const GUEST_KEY = 'cart:guest';

  const [cartProducts, setCartProducts] = useState([]);
  const ls = typeof window !== 'undefined' ? window.localStorage : null;

  // Avoid merging multiple times on a single login
  const mergedOnceRef = useRef(false);

  // One-time migration: if you used to store under 'cart', move it to guest
  useEffect(() => {
    if (!ls) return;
    const legacy = ls.getItem('cart');
    if (legacy && !ls.getItem(GUEST_KEY)) {
      ls.setItem(GUEST_KEY, legacy);
      ls.removeItem('cart');
    }
  }, [ls]);

  // Load the correct cart whenever the user/session changes
  useEffect(() => {
    if (!ls) return;

    // On first authenticated session, optionally merge guest cart → user cart
    if (status === 'authenticated' && !mergedOnceRef.current) {
      try {
        const guestRaw = ls.getItem(GUEST_KEY);
        const userRaw = ls.getItem(STORAGE_KEY);

        const guestCart = guestRaw ? JSON.parse(guestRaw) : [];
        const userCart = userRaw ? JSON.parse(userRaw) : [];

        if (guestCart.length && !userCart.length) {
          ls.setItem(STORAGE_KEY, JSON.stringify(guestCart));
          ls.removeItem(GUEST_KEY);
          setCartProducts(guestCart);
          mergedOnceRef.current = true;
          return; // we've set state already
        }
      } catch {
        // ignore parse errors
      } finally {
        mergedOnceRef.current = true;
      }
    }

    // Load cart for current user (guest or authenticated)
    try {
      const raw = ls.getItem(STORAGE_KEY);
      setCartProducts(raw ? JSON.parse(raw) : []);
    } catch {
      setCartProducts([]);
    }
  }, [ls, STORAGE_KEY, status]);

  function saveCartProductsToLocalStorage(next) {
    if (!ls) return;
    ls.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addToCart(product, size = null, extras = []) {
    setCartProducts((prev) => {
      const cartProduct = { ...product, size, extras };
      const next = [...prev, cartProduct];
      saveCartProductsToLocalStorage(next);
      return next;
    });
    toast.success('Added to cart');
  }

  function removeCartProduct(indexToRemove) {
    setCartProducts((prev) => {
      const next = prev.filter((_, i) => i !== indexToRemove);
      saveCartProductsToLocalStorage(next);
      return next;
    });
    toast.success('Product removed');
  }

  function clearCart() {
    setCartProducts([]);
    saveCartProductsToLocalStorage([]);
  }

  return (
    <CartContext.Provider
      value={{
        cartProducts,
        setCartProducts,
        addToCart,
        removeCartProduct,
        clearCart,
        userId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
