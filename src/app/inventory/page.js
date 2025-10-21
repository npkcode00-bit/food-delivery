// app/inventory/page.js
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/auth';
import { redirect } from 'next/navigation';
import InventoryClientPage from '../components/layout/InventoryClientPage';

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const isAdmin = session?.user?.admin === true || role === 'admin';
  const isCashier = role === 'cashier';

  if (!isAdmin && !isCashier) {
    redirect('/'); // or '/dashboard'
  }

  return <InventoryClientPage />;
}
