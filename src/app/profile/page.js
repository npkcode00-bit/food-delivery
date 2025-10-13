import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/auth';
import ProfileForm from '../components/layout/ProfileForm';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  // Render the client form; it will fetch the latest profile via /api/profile
  return (
    <section className="py-8">
      <h1 className="text-2xl font-semibold mb-4">My Profile</h1>
      <ProfileForm />
    </section>
  );
}
