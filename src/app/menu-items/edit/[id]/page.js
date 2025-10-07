'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'

import Left from '../../../components/icons/Left'
import UserTabs from '../../../components/layout/UserTabs'
import MenuItemForm from '../../../components/layout/MenuItemForm'
import DeleteButton from '../../../components/DeleteButton'

export default function EditMenuItemPage() {
  const { data: session, status } = useSession()
  const isAdmin = !!session?.user?.admin

  const router = useRouter()
  const { id } = useParams()

  const [menuItem, setMenuItem] = useState(null)
  const [saving, setSaving] = useState(false)

  // kick non-admins out
  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) {
      router.replace('/') // or '/login'
    }
  }, [status, isAdmin, router])

  // fetch the item only when authenticated & admin
  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin || !id) return

    ;(async () => {
      try {
        // Prefer a single-item fetch if your API supports it:
        const res = await fetch(`/api/menu-items?_id=${id}`)
        if (res.ok) {
          const data = await res.json()
          // If API returns an array, pick the item; otherwise assume it's a single doc
          setMenuItem(Array.isArray(data) ? data.find(i => i._id === id) ?? null : data)
          return
        }
        // Fallback: fetch all, then find
        const all = await (await fetch('/api/menu-items')).json()
        setMenuItem(all.find(i => i._id === id) ?? null)
      } catch {
        toast.error('Failed to load item')
      }
    })()
  }, [status, isAdmin, id])

  async function handleFormSubmit(ev, formData) {
    ev.preventDefault()
    setSaving(true)

    const savingPromise = (async () => {
      const res = await fetch('/api/menu-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, _id: id }),
      })
      if (!res.ok) throw new Error('Request failed')
    })()

    await toast.promise(savingPromise, {
      loading: 'Saving this tasty item…',
      success: 'Saved',
      error: 'Error',
    })

    setSaving(false)
    router.replace('/menu-items')
  }

  async function handleDeleteClick() {
    const promise = (async () => {
      const res = await fetch(`/api/menu-items?_id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    })()

    await toast.promise(promise, {
      loading: 'Deleting...',
      success: 'Deleted',
      error: 'Error',
    })

    router.replace('/menu-items')
  }

  if (status === 'loading') return 'Loading user info...'
  if (!isAdmin) return null // brief blank while redirect runs

  return (
    <section className="mt-8">
      <UserTabs isAdmin={isAdmin} />

      <div className="max-w-2xl mx-auto mt-8">
         <button className='bg-primary' style={{maxWidth:'250px'}}>
        <Link style={{color:'white'}} href="/menu-items" className="button flex gap-2">
          <Left style={{color:'white'}} />
          <span>Show all menu items</span>
        </Link>
        </button>
      </div>

      <MenuItemForm menuItem={menuItem} onSubmit={handleFormSubmit} />

      <div className="max-w-md mx-auto mt-2">
        <div className="max-w-xs ml-auto pl-4">
          <DeleteButton
            label="Delete this menu item"
            onDelete={handleDeleteClick}
            // remove "disabled" if your DeleteButton doesn't accept it
            disabled={saving}
          />
        </div>
      </div>
    </section>
  )
}
