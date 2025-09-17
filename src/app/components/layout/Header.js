'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

export default function Header() {
  // Destructure so "session" is the actual session data object
  const { data: session, status } = useSession()

  const user = session?.user
  const userName = user?.name || user?.email
  const isAdmin = !!user?.admin // <- admin comes from your NextAuth callbacks

  if (status === 'loading') return null // or show a spinner

  return (
    <header className="flex items-center justify-between">
      <nav className="flex items-center gap-8 text-gray-500 font-semibold">
        <Link className="text-primary font-semibold text-2xl" href="/">
          SHOP NAME HERE
        </Link>
        <Link href="/">Home</Link>
        <Link href="/menu">Menu</Link>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>

        {isAdmin && <Link href="/admin">Admin</Link>}
      </nav>

      <nav className="flex items-center gap-4 text-gray-500 font-semibold">
        {status === 'authenticated' ? (
          <>
            {userName && <span className="text-sm">Hi, {userName}</span>}
            <button
              onClick={() => signOut()}
              className="bg-primary rounded-full text-white px-6 py-2 cursor-pointer"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register" className="bg-primary rounded-full text-white px-6 py-2">
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
