'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import UserTabs from '../components/layout/UserTabs'
import DeleteButton from '../components/DeleteButton'

export default function CategoriesPage() {
  const { data: session, status } = useSession()
  const isAdmin = !!session?.user?.admin

  const [categoryName, setCategoryName] = useState('')
  const [categories, setCategories] = useState([])
  const [editedCategory, setEditedCategory] = useState(null)

  // Fetch categories only when authenticated AND admin
  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      fetchCategories()
    }
  }, [status, isAdmin])

  function fetchCategories() {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((cats) => setCategories(cats))
      .catch(() => {
        toast.error('Failed to load categories')
      })
  }

 async function handleCategorySubmit(ev) {
  ev.preventDefault()

  // Validation: Check if category name is empty or just whitespace
  if (!categoryName || categoryName.trim() === '') {
    toast.error('Category name cannot be empty')
    return
  }

  const creationPromise = new Promise(async (resolve, reject) => {
    try {
      const data = { name: categoryName.trim() } // Also trim whitespace
      if (editedCategory) data._id = editedCategory._id

      const response = await fetch('/api/categories', {
        method: editedCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Request failed')

      setCategoryName('')
      setEditedCategory(null)
      fetchCategories()
      resolve()
    } catch {
      reject()
    }
  })

  await toast.promise(creationPromise, {
    loading: editedCategory ? 'Updating category...' : 'Creating your new category...',
    success: editedCategory ? 'Category updated' : 'Category created',
    error: 'Error, sorry...',
  })
}

  async function handleDeleteClick(_id) {
    const promise = new Promise(async (resolve, reject) => {
      try {
        const response = await fetch('/api/categories?_id=' + _id, {
          method: 'DELETE',
        })
        if (!response.ok) throw new Error('Delete failed')
        resolve()
      } catch {
        reject()
      }
    })

    await toast.promise(promise, {
      loading: 'Deleting...',
      success: 'Deleted',
      error: 'Error',
    })

    fetchCategories()
  }

  // Loading / auth gates
  if (status === 'loading') {
    return 'Loading user info...'
  }

  if (status === 'unauthenticated') {
    return 'Please log in'
  }

  if (!isAdmin) {
    return 'Not an admin'
  }

  return (
    <section className="mt-8 max-w-2xl mx-auto">
      <UserTabs isAdmin={isAdmin} />

      <form className="mt-8" onSubmit={handleCategorySubmit}>
        <div className="flex gap-2 items-end">
          <div className="grow">
            <label>
              {editedCategory ? 'Update category' : 'New category name'}
              {editedCategory && (
                <>
                  : <b>{editedCategory.name}</b>
                </>
              )}
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(ev) => setCategoryName(ev.target.value)}
            />
          </div>
          <div className="pb-2 flex gap-2">
            <button className="border border-primary" type="submit">
              {editedCategory ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditedCategory(null)
                setCategoryName('')
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      <div>
        <h2 className="mt-8 text-sm text-gray-500">Existing categories</h2>
        {categories?.length > 0 &&
          categories.map((c) => (
            <div
              key={c._id}
              className="bg-gray-100 rounded-xl p-2 px-4 flex gap-1 mb-1 items-center"
            >
              <div className="grow">{c.name}</div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditedCategory(c)
                    setCategoryName(c.name)
                  }}
                >
                  Edit
                </button>
                <DeleteButton label="Delete" onDelete={() => handleDeleteClick(c._id)} />
              </div>
            </div>
          ))}
      </div>
    </section>
  )
}
