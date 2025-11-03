// app/api/forgot-password/route.js
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { User } from '../../../app/models/User';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

// ✅ Gmail transporter
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // app password
    },
  });
}

export async function POST(req) {
  try {
    await dbConnect();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don’t reveal if user exists, for security
      return NextResponse.json(
        { message: 'If that email exists, a reset code has been sent.' },
        { status: 200 }
      );
    }

    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = expires;
    await user.save();

    const transporter = getTransporter();

    await transporter.sendMail({
      from: `"Pinagpala Cafe" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password reset code - Pinagpala Cafe',
      text: `Hi ${user.firstName || 'there'},\n\nYour password reset code is: ${otp}\n\nThis code will expire in 10 minutes.`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Password reset code</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header {
                background: linear-gradient(to right, #A5724A, #7A4E2A);
                color: #ffffff;
                padding: 20px;
                text-align: center;
                border-radius: 10px 10px 0 0;
              }
              .content {
                background: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 10px 10px;
              }
              .otp-box {
                background: #ffffff;
                border: 2px solid #A5724A;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
              }
              .otp-code {
                font-size: 32px;
                font-weight: bold;
                color: #A5724A;
                letter-spacing: 5px;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 12px;
                color: #666666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password reset code</h1>
              </div>
              <div class="content">
                <p>Hi ${user.firstName || 'there'},</p>
                <p>Your password reset code is:</p>

                <div class="otp-box">
                  <div class="otp-code">${otp}</div>
                </div>

                <p><strong>This code will expire in 10 minutes.</strong></p>
                <p>If you didn't request a password reset, you can safely ignore this email.</p>

                <div class="footer">
                  <p>© 2025 Pinagpala Cafe. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return NextResponse.json(
      { message: 'If that email exists, a reset code has been sent.' },
      { status: 200 }
    );
  } catch (err) {
    console.error('forgot-password error:', err);
    return NextResponse.json(
      { message: 'Failed to send reset code.' },
      { status: 500 }
    );
  }
}
