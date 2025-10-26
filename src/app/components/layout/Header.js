// src/app/components/layout/Header.js
'use client';

import { useContext, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

import { CartContext } from '../AppContext';
import Bars2 from '../icons/Bars2';
import ShoppingCart from '../icons/ShoppingCart';

function AuthLinks({ status, userFirstName, userName }) {
  if (status === 'loading') return null;

  if (status === 'authenticated') {
    const greeting = userFirstName || userName || '';
    return (
      <div className="flex items-center gap-3">
        {greeting && (
          <Link href="/profile" className="whitespace-nowrap underline hover:no-underline cursor-pointer">
            Hello, {greeting}
          </Link>
        )}
        <button
          onClick={() => signOut()}
          className="bg-primary rounded-full text-white px-6 py-2 cursor-pointer"
          style={{ color: 'white' }}
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <Link
        className="rounded-full px-6 py-2 border-2 cursor-pointer"
        style={{ color: '#AB886D', backgroundColor: 'transparent', borderColor: '#AB886D' }}
        href="/login"
      >
        Login
      </Link>
      <Link
        href="/register"
        className="bg-primary rounded-full text-white px-6 py-2 cursor-pointer"
        style={{ color: 'white' }}
      >
        Register
      </Link>
    </>
  );
}

function CartLink({ count }) {
  return (
    <Link
      href="/cart"
      className="relative cursor-pointer"
      aria-label={`Shopping cart${count ? ` with ${count} items` : ''}`}
    >
      <ShoppingCart />
      {count > 0 && (
        <span className="absolute -top-2 -right-4 bg-primary text-white text-xs py-0.5 px-1.5 rounded-full leading-3">
          {count}
        </span>
      )}
    </Link>
  );
}

export default function Header() {
  const { data: session, status } = useSession();
  const user = session?.user || {};
  const isAuthed = status === 'authenticated';

  const role = user?.role; // 'customer' | 'admin' | 'accounting' | 'cashier' | undefined
  const isAdmin = user?.admin === true || role === 'admin';
  const isAccounting = user?.accounting === true || role === 'accounting';
  const isCustomer = role === 'customer';

  // HOME visibility: show if NOT authenticated OR is customer
  const showHome = !isAuthed || isCustomer;

  const userFirstName = user?.firstName || '';
  let userName = user?.name || user?.email || '';
  if (userName.includes(' ')) userName = userName.split(' ')[0];

  const { cartProducts } = useContext(CartContext);
  const cartCount = cartProducts?.length || 0;

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const canSeeInventory = isAdmin || role === 'cashier';
  const canSeeAccounting = isAdmin || isAccounting;

  // Build nav items with the original conditions, then sort alphabetically by label.
  const navItems = [
    { label: 'Accounting', href: '/accounting', show: canSeeAccounting },
    { label: 'Home', href: '/', show: showHome },
    { label: 'Inventory', href: '/inventory', show: canSeeInventory },
    { label: 'Items', href: '/admin', show: isAdmin },
    { label: 'Menu', href: '/menu', show: user?.role !== 'cashier' },
    { label: 'Orders', href: '/orders', show: isAuthed },
    { label: 'Users', href: '/users', show: isAdmin },
  ]
    .filter(i => i.show)
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <header className="border-b bg-transparent">
      <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
        {/* Top bar (logo + toggles) - mobile */}
        <div className="flex items-center md:hidden justify-between gap-3">
          <img src="/logo.png" alt="Logo" className="w-40 max-w-full h-auto" />
          <div className="flex gap-3 items-center">
            {/* Cart only for authenticated customers */}
            {isAuthed && isCustomer && <CartLink count={cartCount} />}
            <button
              className="p-2 rounded-md border hover:bg-gray-50 cursor-pointer"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <Bars2 />
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="md:hidden mt-2 rounded-xl border bg-white shadow-lg p-4 flex flex-col gap-2 text-center">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {/* Auth */}
            <div className="pt-2 border-t mt-2">
              <AuthLinks
                status={status}
                userFirstName={userFirstName}
                userName={userFirstName || userName}
              />
            </div>
          </div>
        )}

        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between">
          <nav className="flex items-center gap-6 text-gray-600 font-semibold">
            <img src="/logo.png" alt="Logo" className="w-56 lg:w-72 max-w-full h-auto" />

            {navItems.map(item => (
              <Link key={item.href} href={item.href} className="hover:text-black cursor-pointer">
                {item.label}
              </Link>
            ))}
          </nav>

          <nav className="flex items-center gap-4 text-gray-600 font-semibold">
            <AuthLinks
              status={status}
              userFirstName={userFirstName}
              userName={userFirstName || userName}
            />
            {/* Cart only for authenticated customers */}
            {isAuthed && isCustomer && <CartLink count={cartCount} />}
          </nav>
        </div>
      </div>
    </header>
  );
}
