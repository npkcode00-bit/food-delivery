import mongoose from 'mongoose';
import { User } from '../../models/User';
import { PendingUser } from '../../models/PendingUser';
import { generateOTP, sendOTPEmail } from '../lib/emailService.js';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function isValidPhone(str) {
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
      accountType,      // 'customer' | 'rider'
      riderImageData,   // base64 or data URL for rider proof image
    } = body || {};

    if (!email || !password || !firstName || !lastName || !address || !phone) {
      return Response.json(
        { message: 'All fields are required.' },
        { status: 400 }
      );
    }

    const normalizedAccountType = (accountType === 'rider' ? 'rider' : 'customer');

    if (normalizedAccountType === 'rider' && !riderImageData) {
      return Response.json(
        { message: 'Proof image is required for rider accounts.' },
        { status: 400 }
      );
    }

    if (password.length < 5) {
      return Response.json(
        { message: 'Password must be at least 5 characters.' },
        { status: 400 }
      );
    }

    const fn = String(firstName).trim();
    const ln = String(lastName).trim();
    const addr = String(address).trim();
    const ph = String(phone).trim();

    if (fn.length < 2 || ln.length < 2) {
      return Response.json(
        { message: 'Please provide a valid first and last name.' },
        { status: 400 }
      );
    }
    if (addr.length < 5) {
      return Response.json(
        { message: 'Please provide a valid address.' },
        { status: 400 }
      );
    }
    if (!isValidPhone(ph)) {
      return Response.json(
        { message: 'Please provide a valid phone number.' },
        { status: 400 }
      );
    }

    await dbConnect();

    const normalizedEmail = String(email).toLowerCase().trim();

    // Check if user already exists
    const exists = await User.findOne({ email: normalizedEmail }).lean();
    if (exists) {
      return Response.json(
        { message: 'Email already registered.' },
        { status: 409 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing pending registration for this email
    await PendingUser.deleteOne({ email: normalizedEmail });

    // Store pending registration
    await PendingUser.create({
      email: normalizedEmail,
      password,
      firstName: fn,
      lastName: ln,
      address: addr,
      phone: ph,
      otp,
      otpExpiry,
      // NEW fields:
      accountType: normalizedAccountType, // "customer" or "rider"
      riderImageData: normalizedAccountType === 'rider' ? riderImageData : undefined,
    });

    // Send OTP email
    const emailResult = await sendOTPEmail(normalizedEmail, otp, fn);
    
    if (!emailResult.success) {
      return Response.json(
        { message: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    return Response.json(
      {
        message: 'Verification code sent to your email.',
        email: normalizedEmail,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Registration error:', err);
    return Response.json(
      { message: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
