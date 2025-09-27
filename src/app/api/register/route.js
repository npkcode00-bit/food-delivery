import mongoose from 'mongoose';
import { User } from '../../models/User';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ message: 'Email and password are required.' }, { status: 400 });
    }
    if (password.length < 5) {
      return Response.json({ message: 'Password must be at least 5 characters.' }, { status: 400 });
    }

    await dbConnect();

    const normalizedEmail = email.toLowerCase().trim();

    // Soft check for nicer UX (race-safe fallback below)
    const exists = await User.findOne({ email: normalizedEmail }).lean();
    if (exists) {
      return Response.json({ message: 'Email already registered.' }, { status: 409 });
    }

    // Create with plain password — pre('save') will hash it
    const createdUser = await User.create({
      email: normalizedEmail,
      password,
    });

    return Response.json(
      { _id: createdUser._id, email: createdUser.email, message: 'User created.' },
      { status: 201 }
    );
  } catch (err) {
    // Hard guarantee: handle duplicate key race
    if (err?.code === 11000 && (err?.keyPattern?.email || err?.keyValue?.email)) {
      return Response.json({ message: 'Email already registered.' }, { status: 409 });
    }
    console.error(err);
    return Response.json({ message: 'Registration failed.' }, { status: 500 });
  }
}
