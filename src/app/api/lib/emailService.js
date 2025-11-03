// lib/mail.js (or wherever you keep this)
import nodemailer from 'nodemailer';

console.log('🔐 Email Config Check:');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);
console.log('EMAIL_PASSWORD length:', process.env.EMAIL_PASSWORD?.length);

// Shared transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Reusable HTML template for any OTP email
 */
function buildOtpEmailHtml({ title, greetingName, intro, otp }) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header {
            background: linear-gradient(to right, #A5724A, #7A4E2A);
            color: white;
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
            background: white;
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
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            <p>Hi ${greetingName || 'there'},</p>
            <p>${intro}</p>

            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>

            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>

            <div class="footer">
              <p>© 2025 Pinagpala Cafe. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 👉 Registration / email-verify OTP
 */
export async function sendOTPEmail(email, otp, firstName) {
  const html = buildOtpEmailHtml({
    title: 'Welcome to Pinagpala Cafe! ☕',
    greetingName: firstName || 'there',
    intro: 'Thank you for registering with Pinagpala Cafe! Please verify your email address using the OTP code below:',
    otp,
  });

  const mailOptions = {
    from: `"Pinagpala Cafe" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - Pinagpala Cafe ☕',
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 👉 Forgot-password OTP (same style, different copy)
 */
export async function sendPasswordResetEmail(email, otp, firstName) {
  const html = buildOtpEmailHtml({
    title: 'Password reset code',
    greetingName: firstName || 'there',
    intro: 'Your password reset code is:',
    otp,
  });

  const mailOptions = {
    from: `"Pinagpala Cafe" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password reset code - Pinagpala Cafe',
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Reset email send error:', error);
    return { success: false, error: error.message };
  }
}
