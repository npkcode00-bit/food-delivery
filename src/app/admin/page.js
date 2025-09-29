'use client';

import { useSession } from 'next-auth/react';
import UserTabs from '../components/layout/UserTabs';

export default function AdminPanel() {
  const { data: session } = useSession();
  const isAdmin = !!session?.user?.admin;

  return (
    <div>
      <UserTabs isAdmin={isAdmin} />
    </div>
  );
}