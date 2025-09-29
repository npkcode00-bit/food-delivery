'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import Right from '../components/icons/Right'
import UserTabs from '../components/layout/UserTabs'

export default function MenuItemsPage() {
  const { data: session, status } = useSession()
  const isAdmin = !!session?.user?.admin

  const [menuItems, setMenuItems] = useState([])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      fetch('/api/menu-items')
        .then((res) => res.json())
        .then((items) => setMenuItems(items))
        .catch(() => {
          // optional: show a toast or set an error state
        })
    }
  }, [status, isAdmin])

  if (status === 'loading') return 'Loading user info...'
  if (status === 'unauthenticated') return 'Please log in.'
  if (!isAdmin) return 'Not an admin.'

  const FALLBACK_SRC = "/no-image.jpg";

  return (
    <section className="mt-8 max-w-2xl mx-auto">
      <UserTabs isAdmin={isAdmin} />

      <div className="mt-8">
        <Link className="button flex" href="/menu-items/new">
          <span>Create new menu item</span>
          <Right />
        </Link>
      </div>

      <div>
        <h2 className="text-sm text-gray-500 mt-8">Edit menu item:</h2>
        <div className="grid grid-cols-3 gap-2">
          {menuItems?.length > 0 &&
            menuItems.map((item) => (
              <Link
                key={item._id}
                href={`/menu-items/edit/${item._id}`}
                className="bg-gray-200 rounded-lg p-4"
              >
                <div className="relative">
                  <Image
                    className="rounded-md"
                    src={item.image || FALLBACK_SRC}
                    alt={item.name ?? ''}
                    width={200}
                    height={200}
                  />
                </div>
                <div className="text-center">{item.name}</div>
              </Link>
            ))}
        </div>
      </div>
    </section>
  )
}
