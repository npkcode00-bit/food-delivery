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
          <Link href="/profile" className="whitespace-nowrap underline">
            Hello, {greeting}
          </Link>
        )}
        <button
          onClick={() => signOut()}
          className="bg-primary rounded-full text-white px-8 py-2 cursor-pointer"
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
        style={{ color: '#AB886D', backgroundColor: 'transparent', border: '2px solid #AB886D' }}
        className="rounded-full px-8 py-2"
        href="/login"
      >
        Login
      </Link>
      <Link style={{ color: 'white' }} href="/register" className="bg-primary rounded-full text-white px-8 py-2">
        Register
      </Link>
    </>
  );
}

function CartLink({ count }) {
  return (
    <Link href="/cart" className="relative" aria-label={`Shopping cart${count ? ` with ${count} items` : ''}`}>
      <ShoppingCart />
      {count > 0 && (
        <span className="absolute -top-2 -right-4 bg-primary text-white text-xs py-1 px-1 rounded-full leading-3">
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
  const isAdmin = user?.admin === true || role === 'admin'; // legacy flag supported
  const isCustomer = role === 'customer';

  // HOME visibility rule: show if NOT authenticated OR role === 'customer'
  const showHome = !isAuthed || isCustomer;

  const userFirstName = user?.firstName || '';
  let userName = user?.name || user?.email || '';
  if (userName.includes(' ')) userName = userName.split(' ')[0];

  const { cartProducts } = useContext(CartContext);
  const cartCount = cartProducts?.length || 0;

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header>
      {/* Mobile header */}
      <div className="flex items-center md:hidden justify-between">
        <img src="/logo.png" alt="Logo" style={{ width: '300px' }} />
        <div className="flex gap-8 items-center">
          {/* Cart only for authenticated customers */}
          {isAuthed && isCustomer && <CartLink count={cartCount} />}
          <button
            className="p-1 border"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <Bars2 />
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden p-4 bg-gray-200 rounded-lg mt-2 flex flex-col gap-2 text-center"
        >
          {/* Home visible to guests and customers; hidden from admin/accounting/cashier */}
          {showHome && <Link href="/">Home</Link>}

           {/* show Menu only when user.role is NOT cashier */}
     
   {user?.role !== 'accounting' && (
  <Link href="/menu">Menu</Link>
)}

      {/* other nav items */}

          {/* Orders visible to any authenticated user */}
          {isAuthed && <Link href="/orders">Orders</Link>}

          {/* Admin links */}
          {isAdmin && <Link href="/admin" className="mr-2">Items</Link>}
          {isAdmin && <Link href="/users" className="mr-2">Users</Link>}

          <AuthLinks status={status} userFirstName={userFirstName} userName={userFirstName || userName} />
        </div>
      )}

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between">
        <nav className="flex items-center gap-8 text-gray-500 font-semibold">
          <img src="/logo.png" alt="Logo" style={{ width: '300px' }} />

          {/* Home visible to guests and customers; hidden from admin/accounting/cashier */}
          {showHome && <Link href="/">Home</Link>}

          {/* Orders visible to any authenticated user */}
          {isAuthed && <Link href="/orders" className="mr-2">Orders</Link>}

          {/* Admin links */}
          {isAdmin && <Link href="/admin">Items</Link>}
          {isAdmin && <Link href="/users">Users</Link>}

           {/* show Menu only when user.role is NOT cashier */}
    {user?.role !== 'accounting' && (
  <Link href="/menu">Menu</Link>
)}

      {/* other nav items */}
        </nav>

        <nav className="flex items-center gap-4 text-gray-500 font-semibold">
          <AuthLinks status={status} userFirstName={userFirstName} userName={userFirstName || userName} />
          {/* Cart only for authenticated customers */}
          {isAuthed && isCustomer && <CartLink count={cartCount} />}
        </nav>
      </div>
    </header>
  );
}
