import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../api/auth/[...nextauth]/auth';
import { User } from '../../../app/models/User';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

const ALLOWED_ROLES = ['customer', 'admin', 'accounting', 'cashier'];

function jsonError(message, status = 500, extra = {}) {
  return Response.json({ message, ...extra }, { status });
}

// GET /api/admin/users?role=customer|admin|accounting|cashier|all
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.admin) {
      return jsonError('Forbidden', 403);
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');

    const query = {};
    if (role && role !== 'all') query.role = role;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({ users }, { status: 200 });
  } catch (err) {
    console.error('GET /api/users failed:', err);
    return jsonError('Failed to fetch users.', 500);
  }
}

// PATCH /api/admin/users
// Body: { id, updates: { firstName, lastName, address, phone, email, role } }
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.admin) {
      return jsonError('Forbidden', 403);
    }

    await dbConnect();

    const { id, updates } = await req.json();

    if (!id) return jsonError('Missing user id.', 400);
    if (!mongoose.Types.ObjectId.isValid(id)) return jsonError('Invalid user id.', 400);
    if (!updates || typeof updates !== 'object') return jsonError('Invalid payload.', 400);

    const allowed = ['firstName', 'lastName', 'address', 'phone', 'email', 'role'];
    const $set = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        const val = updates[key];
        if (typeof val === 'string') $set[key] = val.trim();
        else if (val !== undefined) $set[key] = val;
      }
    }

    if ($set.role && !ALLOWED_ROLES.includes($set.role)) {
      return jsonError('Invalid role.', 400);
    }
    if ($set.role) $set.admin = $set.role === 'admin';

    const updated = await User.findByIdAndUpdate(
      id,
      { $set },
      { new: true, runValidators: true }
    ).select('-password').lean();

    if (!updated) return jsonError('User not found.', 404);

    return Response.json({ user: updated }, { status: 200 });
  } catch (err) {
    // Duplicate email
    if (err?.code === 11000 && (err?.keyPattern?.email || err?.keyValue?.email)) {
      return jsonError('Email already in use.', 409);
    }
    // Mongoose validation/cast errors
    if (err?.name === 'CastError') {
      return jsonError('Invalid value provided.', 400, { field: err.path });
    }
    if (err?.name === 'ValidationError') {
      const details = Object.values(err.errors || {}).map(e => e.message).join('; ');
      return jsonError(details || 'Validation failed.', 400);
    }

    console.error('PATCH /api/users failed:', err);
    return jsonError('Failed to update user.', 500);
  }
}

// DELETE /api/admin/users
// Body: { id }
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.admin) {
      return jsonError('Forbidden', 403);
    }

    await dbConnect();

    const { id } = await req.json();
    if (!id) return jsonError('User id required.', 400);
    if (!mongoose.Types.ObjectId.isValid(id)) return jsonError('Invalid user id.', 400);

    if (String(session.user.id) === String(id)) {
      return jsonError('You cannot delete your own account.', 400);
    }

    const deleted = await User.findByIdAndDelete(id).select('-password').lean();
    if (!deleted) return jsonError('User not found.', 404);

    return Response.json({ user: deleted }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/users failed:', err);
    return jsonError('Failed to delete user.', 500);
  }
}
