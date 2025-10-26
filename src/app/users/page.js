import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/auth';
import AdminUsersClient from '../components/layout/AdminUsersClient';

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.admin) redirect('/');

  return (
    <section className="relative">
      {/* soft background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      {/* single window wrapper like home */}
      <div className="mx-auto max-w-8xl overflow-hidden rounded-2xl">
        {/* glossy top highlight */}
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        <div className="px-6 py-10 md:px-12 md:py-14">
          <h1 className="text-2xl font-semibold mb-6">Users</h1>
          <AdminUsersClient />
        </div>
      </div>
    </section>
  );
}
