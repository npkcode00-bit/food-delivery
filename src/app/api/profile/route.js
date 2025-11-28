import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import { User } from '../../../app/models/User';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function jsonError(message, status = 500, extra = {}) {
  return Response.json({ message, ...extra }, { status });
}

// GET /api/profile -> current user's profile (without password)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return jsonError('Unauthorized', 401);

    await dbConnect();

    const me = await User.findById(session.user.id)
      .select('-password')
      .lean();

    if (!me) return jsonError('User not found', 404);
    return Response.json({ user: me }, { status: 200 });
  } catch (err) {
    console.error('GET /api/profile failed:', err);
    return jsonError('Failed to fetch profile', 500);
  }
}

// PATCH /api/profile -> update current user's profile fields
// Body: { firstName, lastName, street, barangay, city, province, phone }
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return jsonError('Unauthorized', 401);

    await dbConnect();

    const body = await req.json();
    const allowed = [
      'firstName',
      'lastName',
      'street',
      'barangay',
      'city',
      'province',
      'phone',
    ];
    const $set = {};

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        const v = body[key];
        $set[key] = typeof v === 'string' ? v.trim() : v;
      }
    }

    // Basic validation
    if (
      !$set.firstName ||
      !$set.lastName ||
      !$set.street ||
      !$set.barangay ||
      !$set.phone
    ) {
      return jsonError('All fields are required.', 400);
    }

    // Construct full address from components
    const street = $set.street || '';
    const barangay = $set.barangay || '';
    const city = $set.city || 'San Mateo';
    const province = $set.province || 'Rizal';

    $set.address = `${street}, ${barangay}, ${city}, ${province}`;
    $set.city = city;
    $set.province = province;

    const updated = await User.findByIdAndUpdate(
      session.user.id,
      { $set },
      { new: true, runValidators: true }
    )
      .select('-password')
      .lean();

    if (!updated) return jsonError('User not found', 404);
    return Response.json(
      { user: updated, message: 'Profile updated' },
      { status: 200 }
    );
  } catch (err) {
    if (err?.name === 'ValidationError') {
      const msg = Object.values(err.errors || {})
        .map((e) => e.message)
        .join('; ');
      return jsonError(msg || 'Validation failed.', 400);
    }
    console.error('PATCH /api/profile failed:', err);
    return jsonError('Failed to update profile', 500);
  }
}
