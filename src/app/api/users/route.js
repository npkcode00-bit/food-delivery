import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import { User } from '../../../app/models/User';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

const ALLOWED_ROLES = ['customer', 'admin', 'accounting', 'cashier', 'superadmin'];

function jsonError(message, status = 500, extra = {}) {
  return Response.json({ message, ...extra }, { status });
}

// GET /api/users?role=customer&page=1&limit=10&archived=false
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    const isSuperAdmin = session?.user?.role === 'superadmin';
    const isAdmin = session?.user?.admin === true || session?.user?.role === 'admin';
    
    if (!isSuperAdmin && !isAdmin) {
      return jsonError('Forbidden', 403);
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const archived = searchParams.get('archived') === 'true';

    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);

    // Build query - handles users without archived field
    const query = archived 
      ? { archived: true }
      : { archived: { $ne: true } };
    
    if (role && role !== 'all') query.role = role;

    const total = await User.countDocuments(query);

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((validPage - 1) * validLimit)
      .limit(validLimit)
      .lean();

    return Response.json({ 
      users, 
      total,
      page: validPage,
      limit: validLimit,
      totalPages: Math.ceil(total / validLimit)
    }, { status: 200 });
  } catch (err) {
    console.error('GET /api/users failed:', err);
    return jsonError('Failed to fetch users.', 500);
  }
}

// PATCH /api/users
// Body: { id, updates: { firstName, lastName, address, phone, email, role } }
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    const isSuperAdmin = session?.user?.role === 'superadmin';
    const isAdmin = session?.user?.admin === true || session?.user?.role === 'admin';
    
    if (!isSuperAdmin && !isAdmin) {
      return jsonError('Forbidden', 403);
    }

    await dbConnect();

    const { id, updates } = await req.json();

    if (!id) return jsonError('Missing user id.', 400);
    if (!mongoose.Types.ObjectId.isValid(id)) return jsonError('Invalid user id.', 400);
    if (!updates || typeof updates !== 'object') return jsonError('Invalid payload.', 400);

    // Check if target user is a super admin
    const targetUser = await User.findById(id).select('role email').lean();
    if (!targetUser) return jsonError('User not found.', 404);

    // Prevent users from changing their own role
    if (String(session.user.email) === String(targetUser.email) && updates.role && updates.role !== targetUser.role) {
      return jsonError('You cannot change your own role.', 403);
    }

    // Only super admins can modify other super admins
    if (targetUser.role === 'superadmin' && !isSuperAdmin) {
      return jsonError('Only super admins can modify super admin accounts.', 403);
    }

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

    // Only super admins can assign super admin role
    if ($set.role === 'superadmin' && !isSuperAdmin) {
      return jsonError('Only super admins can assign super admin role.', 403);
    }

    // Regular admins cannot change someone to super admin
    if ($set.role === 'superadmin' && !isSuperAdmin) {
      return jsonError('Insufficient permissions to assign super admin role.', 403);
    }

    if ($set.role) {
      $set.admin = $set.role === 'admin' || $set.role === 'superadmin';
    }

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

// DELETE /api/users (archives the user)
// Body: { id }
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    const isSuperAdmin = session?.user?.role === 'superadmin';
    const isAdmin = session?.user?.admin === true || session?.user?.role === 'admin';
    
    if (!isSuperAdmin && !isAdmin) {
      return jsonError('Forbidden', 403);
    }

    await dbConnect();

    const { id } = await req.json();
    if (!id) return jsonError('User id required.', 400);
    if (!mongoose.Types.ObjectId.isValid(id)) return jsonError('Invalid user id.', 400);

    // Cannot archive own account
    if (String(session.user.id) === String(id)) {
      return jsonError('You cannot archive your own account.', 400);
    }

    // Check if target user is a super admin
    const targetUser = await User.findById(id).select('role').lean();
    if (!targetUser) return jsonError('User not found.', 404);

    // Only super admins can archive other super admins
    if (targetUser.role === 'superadmin' && !isSuperAdmin) {
      return jsonError('Only super admins can archive super admin accounts.', 403);
    }

    // Prevent archiving the last super admin
    if (targetUser.role === 'superadmin') {
      const superAdminCount = await User.countDocuments({ 
        role: 'superadmin', 
        archived: { $ne: true } 
      });
      
      if (superAdminCount <= 1) {
        return jsonError('Cannot archive the last super admin account.', 400);
      }
    }

    // Archive the user
    const archived = await User.findByIdAndUpdate(
      id,
      { $set: { archived: true } },
      { new: true }
    ).select('-password').lean();

    if (!archived) return jsonError('User not found.', 404);

    return Response.json({ user: archived, message: 'User archived successfully' }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/users failed:', err);
    return jsonError('Failed to archive user.', 500);
  }
}