'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import UserTabs from '../components/layout/UserTabs'

export default function UserPanel() {
  const { data: session, status } = useSession()
  const isAdmin = !!session?.user?.admin
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) {
      router.replace('/') // or '/login'
    }
  }, [status, isAdmin, router])

  if (status === 'loading') return null
  if (!isAdmin) return null

  return (
    <div className="mt-8 max-w-lg mx-auto">
      <UserTabs isAdmin={isAdmin} />
      user
    </div>
  )
}
