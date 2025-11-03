// app/api/reset-password/route.js
import mongoose from 'mongoose';
import { User } from '../../../app/models/User';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

export async function POST(req) {
  try {
    await dbConnect();
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return Response.json(
        { message: 'Email, code and new password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const code = String(otp).trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return Response.json({ message: 'Invalid code.' }, { status: 400 });
    }

    if (String(user.resetOtp) !== code) {
      return Response.json({ message: 'Invalid code.' }, { status: 400 });
    }

    if (user.resetOtpExpires < new Date()) {
      return Response.json({ message: 'Code has expired.' }, { status: 400 });
    }

    if (newPassword.length < 5) {
      return Response.json(
        { message: 'Password must be at least 5 characters.' },
        { status: 400 }
      );
    }

    // ❌ NO MANUAL HASH HERE
    user.password = newPassword;          // plain text for now
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();                    // pre('save') will hash it once

    return Response.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('reset-password error:', err);
    return Response.json(
      { message: 'Server error. Please try again later.' },
      { status: 500 }
    );
  }
}
