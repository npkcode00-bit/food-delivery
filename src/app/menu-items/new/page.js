'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'

import Left from '../../components/icons/Left'
import UserTabs from '../../components/layout/UserTabs'
import MenuItemForm from '../../components/layout/MenuItemForm'

export default function NewMenuItemPage() {
  const { data: session, status } = useSession()
  const isAdmin = !!session?.user?.admin
  const router = useRouter()

  // Gate: if authenticated but not admin, send away
  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) {
      router.replace('/') // or '/login'
    }
  }, [status, isAdmin, router])

  // Submit handler from MenuItemForm
  async function handleFormSubmit(ev, formData) {
    ev.preventDefault()
    const savingPromise = (async () => {
      const res = await fetch('/api/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Request failed')
    })()

    await toast.promise(savingPromise, {
      loading: 'Saving this tasty item…',
      success: 'Saved',
      error: 'Error, sorry…',
    })

    router.replace('/menu-items')
  }

  if (status === 'loading') return 'Loading user info…'
  if (!isAdmin) return null // brief blank while redirect runs

  return (
    <section className="mt-8">
      <UserTabs isAdmin={isAdmin} />
      <div className="max-w-2xl mx-auto mt-8">
        <Link href="/menu-items" className="button">
          <Left />
          <span>Show all menu items</span>
        </Link>
      </div>
      <MenuItemForm menuItem={null} onSubmit={handleFormSubmit} />
    </section>
  )
}
