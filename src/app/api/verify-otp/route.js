// app/api/verify-otp/route.js
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

    // ---- NEW: build address parts ----
    const street = pending.street || '';
    const barangay = pending.barangay || '';
    const city = pending.city || 'San Mateo';
    const province = pending.province || 'Rizal';

    const fullAddress =
      pending.address || `${street}, ${barangay}, ${city}, ${province}`;

    // use accountType from PendingUser to set role
    const role =
      pending.accountType === 'rider' ? 'rider' : 'customer';

    // Create actual user (UserSchema.pre('save') will hash password & set flags)
    const createdUser = await User.create({
      email: pending.email,
      password: pending.password,
      firstName: pending.firstName,
      lastName: pending.lastName,

      // full + split address fields
      address: fullAddress,
      street,
      barangay,
      city,
      province,
      phone: pending.phone,

      role,
      isEmailVerified: true,

      // keep rider proof only for riders
      riderImageData:
        role === 'rider' ? pending.riderImageData : undefined,
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
