import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';  // ← Fixed path
import { User } from '../../models/User';  // ← Fixed path

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function jsonError(message, status = 500, extra = {}) {
  return Response.json({ message, ...extra }, { status });
}

// POST /api/user-restore
// Body: { id }
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.admin) {
      return jsonError('Forbidden', 403);
    }

    await dbConnect();

    const { id } = await req.json();
    if (!id) return jsonError('User id required.', 400);
    if (!mongoose.Types.ObjectId.isValid(id)) return jsonError('Invalid user id.', 400);

    // Restore (unarchive) the user
    const restored = await User.findByIdAndUpdate(
      id,
      { $set: { archived: false } },
      { new: true }
    ).select('-password').lean();

    if (!restored) return jsonError('User not found.', 404);

    return Response.json({ user: restored, message: 'User restored successfully' }, { status: 200 });
  } catch (err) {
    console.error('POST /api/user-restore failed:', err);
    return jsonError('Failed to restore user.', 500);
  }
}