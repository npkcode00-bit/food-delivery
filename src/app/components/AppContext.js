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

export function AppProvider({ children }) {
  return (
    <SessionProvider>
      <CartProviderInner>{children}</CartProviderInner>
    </SessionProvider>
  );
}

function CartProviderInner({ children }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || 'guest';
  const STORAGE_KEY = `cart:${userId}`;
  const GUEST_KEY = 'cart:guest';

  const [cartProducts, setCartProducts] = useState([]);
  const ls = typeof window !== 'undefined' ? window.localStorage : null;

  const mergedOnceRef = useRef(false);

  // IMMEDIATE clear on mount if success/clear-cart param exists
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const url = window.location.href;
    if (url.includes('clear-cart=1') || url.includes('success=1')) {
      // Clear ALL possible cart keys immediately
      if (ls) {
        const allKeys = Object.keys(ls);
        allKeys.forEach(key => {
          if (key.startsWith('cart')) {
            ls.removeItem(key);
          }
        });
      }
      
      // Set empty cart
      setCartProducts([]);
      
      // Show toast
      toast.success('Payment successful! Thank you for your order.');
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // Run only once on mount

  useEffect(() => {
    if (!ls) return;
    const legacy = ls.getItem('cart');
    if (legacy && !ls.getItem(GUEST_KEY)) {
      ls.setItem(GUEST_KEY, legacy);
      ls.removeItem('cart');
    }
  }, [ls]);

  useEffect(() => {
    if (!ls) return;

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
          return;
        }
      } catch {
        // ignore parse errors
      } finally {
        mergedOnceRef.current = true;
      }
    }

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
    if (ls) {
      ls.removeItem(STORAGE_KEY);
    }
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