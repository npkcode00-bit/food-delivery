import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/auth';
import AdminUsersClient from '../components/layout/AdminUsersClient';

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.admin) redirect('/');

  return (
    <section className="max-w-7xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-4">Users</h1>
      <AdminUsersClient />
    </section>
  );
}
