'use client';

import { useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
          <Link
            href="/profile"
            className="whitespace-nowrap underline hover:no-underline cursor-pointer"
          >
            Hello, {greeting}
          </Link>
        )}
        <button
          onClick={() => signOut()}
          className="bg-primary rounded-full text-white px-6 py-2 cursor-pointer whitespace-nowrap"
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
        className="rounded-full px-6 py-2 border-2 cursor-pointer whitespace-nowrap"
        style={{
          color: '#AB886D',
          backgroundColor: 'transparent',
          borderColor: '#AB886D',
        }}
        href="/login"
      >
        Login
      </Link>
      <Link
        href="/register"
        className="bg-primary rounded-full text-white px-6 py-2 cursor-pointer whitespace-nowrap"
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
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user || {};
  const isAuthed = status === 'authenticated';

  const role = user?.role;
  const isAdmin = user?.admin === true || role === 'admin';
  const isAccounting = user?.accounting === true || role === 'accounting';
  const isCashier = user?.cashier === true || role === 'cashier';
  const isRider = role === 'rider';
  const isCustomer = role === 'customer';

  // Show home only if customer or not logged in
  const showHome = !isAuthed || isCustomer;

  const userFirstName = user?.firstName || '';
  let userName = user?.name || user?.email || '';
  if (userName.includes(' ')) userName = userName.split(' ')[0];

  const { cartProducts } = useContext(CartContext);
  const cartCount = cartProducts?.length || 0;

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const canSeeInventory = isAdmin || isCashier;
  const canSeeAccounting = isAdmin || isAccounting;

  let navItems;

  // ⭐ If rider (and not admin), ONLY show the Rider tab
  if (isRider && !isAdmin) {
    navItems = [
      {
        label: 'Rider',
        href: '/rider',
        show: true,
      },
    ];
  } else {
    // Normal nav for everyone else
    navItems = [
      { label: 'Accounting', href: '/accounting', show: canSeeAccounting },
      { label: 'Home', href: '/', show: showHome },
      { label: 'Inventory', href: '/inventory', show: canSeeInventory },
      { label: 'Items', href: '/admin', show: isAdmin },
      {
        label: 'Menu',
        href: '/menu',
        show: !isAccounting && !isCashier,
      },
      { label: 'Orders', href: '/orders', show: isAuthed },
      { label: 'Users', href: '/users', show: isAdmin },
      {
        label: 'Rider',
        href: '/rider',
        show: isAdmin || isRider,
      },
    ]
      .filter((i) => i.show)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="border-b bg-transparent">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
        {/* MOBILE HEADER */}
        <div className="flex items-center md:hidden justify-between gap-3">
          <img src="/logo.png" alt="Logo" className="w-40 max-w-full h-auto" />
          <div className="flex gap-3 items-center">
            {isAuthed && isCustomer && <CartLink count={cartCount} />}
            <button
              className="p-2 rounded-md border hover:bg-white/80 cursor-pointer transition"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <Bars2 />
            </button>
          </div>
        </div>

        {/* MOBILE NAV DRAWER */}
        {mobileNavOpen && (
          <div className="md:hidden mt-2 rounded-xl border bg-white shadow-lg p-4 flex flex-col gap-2 text-center">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`py-2 px-4 rounded-lg cursor-pointer transition ${
                    active
                      ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white font-semibold shadow-md'
                      : 'hover:bg-[#F3EDE2] text-gray-700'
                  }`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="pt-2 border-t mt-2 flex flex-col gap-2">
              <AuthLinks
                status={status}
                userFirstName={userFirstName}
                userName={userFirstName || userName}
              />
            </div>
          </div>
        )}

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 lg:gap-4 xl:gap-6 text-gray-600 font-semibold">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-40 lg:w-56 xl:w-64 max-w-full h-auto flex-shrink-0"
            />

            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2 lg:px-3 xl:px-4 py-2 rounded-lg cursor-pointer transition whitespace-nowrap text-sm lg:text-base ${
                    active
                      ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white font-bold shadow-md'
                      : 'hover:bg-white/60 hover:text-[#7A4E2A]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 lg:gap-4 text-gray-600 font-semibold flex-shrink-0">
            <AuthLinks
              status={status}
              userFirstName={userFirstName}
              userName={userFirstName || userName}
            />
            {isAuthed && isCustomer && <CartLink count={cartCount} />}
          </div>
        </div>
      </div>
    </header>
  );
}
