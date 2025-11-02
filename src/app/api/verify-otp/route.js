import mongoose from 'mongoose';
import { User } from '../../models/User';
import { PendingUser } from '../../models/PendingUser';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

export async function POST(req) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return Response.json(
        { message: 'Email and OTP are required.' },
        { status: 400 }
      );
    }

    await dbConnect();

    const normalizedEmail = String(email).toLowerCase().trim();

    // Find pending registration
    const pending = await PendingUser.findOne({ email: normalizedEmail });

    if (!pending) {
      return Response.json(
        { message: 'No pending registration found. Please register again.' },
        { status: 404 }
      );
    }

    // Check if OTP expired
    if (new Date() > pending.otpExpiry) {
      await PendingUser.deleteOne({ email: normalizedEmail });
      return Response.json(
        { message: 'OTP expired. Please register again.' },
        { status: 400 }
      );
    }

    // Verify OTP
    if (pending.otp !== otp) {
      return Response.json(
        { message: 'Invalid OTP. Please try again.' },
        { status: 400 }
      );
    }

    // Create actual user
    const createdUser = await User.create({
      email: pending.email,
      password: pending.password,
      firstName: pending.firstName,
      lastName: pending.lastName,
      address: pending.address,
      phone: pending.phone,
      isEmailVerified: true,
    });

    // Delete pending registration
    await PendingUser.deleteOne({ email: normalizedEmail });

    return Response.json(
      {
        _id: createdUser._id,
        email: createdUser.email,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        message: 'Email verified successfully! You can now log in.',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('OTP verification error:', err);
    return Response.json(
      { message: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}