'use client';

import { useContext, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

import { CartContext } from '../AppContext';
import Bars2 from '../icons/Bars2';
import ShoppingCart from '../icons/ShoppingCart';

function AuthLinks({ status, userName }) {
  if (status === 'loading') return null;

  if (status === 'authenticated') {
    return (
      <>
        {userName && (
          <div className="whitespace-nowrap">
            Hello, {userName}
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="bg-primary rounded-full text-white px-8 py-2 cursor-pointer"
          style={{color:'white'}}
        >
          Logout
        </button>
      </>
    );
  }

  return (
    <>
      <Link  style={{color:'#AB886D', backgroundColor:'transparent',border:'2px solid #AB886D'}}  className="rounded-full px-8 py-2"  href="/login">Login</Link>
      <Link  style={{color:'white'}} href="/register" className="bg-primary rounded-full text-white px-8 py-2">
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
  const user = session?.user;
  const isAdmin = !!user?.admin;
  const isAuthed = status === 'authenticated';

  let userName = user?.name || user?.email || '';
  if (userName.includes(' ')) userName = userName.split(' ')[0];

  const { cartProducts } = useContext(CartContext);
  const cartCount = cartProducts?.length || 0;

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const brandTitle = 'ST PIZZA';

  return (
    <header>
      {/* Mobile header */}
      <div className="flex items-center md:hidden justify-between">
        <Link className="text-primary font-semibold text-2xl" href="/">
          {brandTitle}
        </Link>
        <div className="flex gap-8 items-center">
          {isAuthed && <CartLink count={cartCount} />}
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
          <Link href="/">Home</Link>
          <Link href="/menu">Menu</Link>
          <Link href="/#about">About</Link>
          <Link href="/#contact">Contact</Link>
          {isAuthed && <Link href="/orders">Orders</Link>}
          {isAdmin && <Link href="/admin">Admin</Link>}
          <AuthLinks status={status} userName={userName} />
        </div>
      )}

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between">
        <nav className="flex items-center gap-8 text-gray-500 font-semibold">
          <Link className="text-primary font-semibold text-2xl" href="/">
            {brandTitle}
          </Link>
          <Link href="/">Home</Link>
          <Link href="/menu">Menu</Link>
          <Link href="/#about">About</Link>
          <Link href="/#contact">Contact</Link>
          {isAuthed && <Link href="/orders" className='mr-2'>Orders</Link>}
          {isAdmin && <Link href="/admin">Admin</Link>}
        </nav>

        <nav className="flex items-center gap-4 text-gray-500 font-semibold">
          <AuthLinks status={status} userName={userName} />
          {isAuthed && <CartLink count={cartCount} />}
        </nav>
      </div>
    </header>
  );
}