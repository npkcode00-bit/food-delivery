import mongoose from 'mongoose';
import { User } from '../../models/User';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function isValidPhone(str) {
  // simple: allow +, digits, spaces, dashes, parentheses; length >= 6
  return /^[+\d][\d\s\-()]{5,}$/.test(str || '');
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      firstName,
      lastName,
      address,
      phone,
      // NOTE: we ignore any incoming role from client for safety
    } = body || {};

    if (!email || !password || !firstName || !lastName || !address || !phone) {
      return Response.json(
        { message: 'Email, password, first name, last name, address, and phone are required.' },
        { status: 400 }
      );
    }

    if (password.length < 5) {
      return Response.json({ message: 'Password must be at least 5 characters.' }, { status: 400 });
    }

    const fn = String(firstName).trim();
    const ln = String(lastName).trim();
    const addr = String(address).trim();
    const ph = String(phone).trim();

    if (fn.length < 2 || ln.length < 2) {
      return Response.json({ message: 'Please provide a valid first and last name.' }, { status: 400 });
    }
    if (addr.length < 5) {
      return Response.json({ message: 'Please provide a valid address.' }, { status: 400 });
    }
    if (!isValidPhone(ph)) {
      return Response.json({ message: 'Please provide a valid phone number.' }, { status: 400 });
    }

    await dbConnect();

    const normalizedEmail = String(email).toLowerCase().trim();

    const exists = await User.findOne({ email: normalizedEmail }).lean();
    if (exists) {
      return Response.json({ message: 'Email already registered.' }, { status: 409 });
    }

    // Create user. Role is auto-populated to 'customer' by default.
    const createdUser = await User.create({
      email: normalizedEmail,
      password,
      firstName: fn,
      lastName: ln,
      address: addr,
      phone: ph,
      // role is omitted on purpose so schema default applies
      // admin will auto-sync via pre('save') if role changes
    });

    return Response.json(
      {
        _id: createdUser._id,
        email: createdUser.email,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        address: createdUser.address,
        phone: createdUser.phone,
        role: createdUser.role,      // <-- return role
        admin: createdUser.admin,    // <-- return admin for completeness
        message: 'User created.',
      },
      { status: 201 }
    );
  } catch (err) {
    if (err?.code === 11000 && (err?.keyPattern?.email || err?.keyValue?.email)) {
      return Response.json({ message: 'Email already registered.' }, { status: 409 });
    }
    console.error(err);
    return Response.json({ message: 'Registration failed.' }, { status: 500 });
  }
}
