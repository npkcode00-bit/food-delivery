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
      street,          // NEW
      barangay,        // NEW
      city,            // NEW (fixed to "San Mateo")
      province,        // NEW (fixed to "Rizal")
      phone,
      accountType,
      riderImageData,
    } = body || {};

    if (!email || !password || !firstName || !lastName || !street || !barangay || !phone) {
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
    const st = String(street).trim();
    const brgy = String(barangay).trim();
    const ph = String(phone).trim();

    if (fn.length < 2 || ln.length < 2) {
      return Response.json(
        { message: 'Please provide a valid first and last name.' },
        { status: 400 }
      );
    }
    if (st.length < 3) {
      return Response.json(
        { message: 'Please provide a valid street address.' },
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

    // Construct full address
    const fullAddress = `${st}, ${brgy}, ${city || 'San Mateo'}, ${province || 'Rizal'}`;

    // Store pending registration
    await PendingUser.create({
      email: normalizedEmail,
      password,
      firstName: fn,
      lastName: ln,
      address: fullAddress,  // Store as complete address
      street: st,            // Store separately for future editing
      barangay: brgy,
      city: city || 'San Mateo',
      province: province || 'Rizal',
      phone: ph,
      otp,
      otpExpiry,
      accountType: normalizedAccountType,
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