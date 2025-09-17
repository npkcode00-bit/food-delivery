'use client'

import { useState } from 'react'



import UserTabs from '../components/layout/UserTabs'



export default function AdminPanel () {
     const [isAdmin, setIsAdmin] = useState(true)
    return (
        <div>
            <UserTabs isAdmin={isAdmin} />
        </div>
    )
}