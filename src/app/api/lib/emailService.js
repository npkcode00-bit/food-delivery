import nodemailer from 'nodemailer';

console.log('🔐 Email Config Check:');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);
console.log('EMAIL_PASSWORD length:', process.env.EMAIL_PASSWORD?.length);

// Create transporter (using Gmail as example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASSWORD, // your app password
  },
});

export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

export async function sendOTPEmail(email, otp, firstName) {
  const mailOptions = {
    from: `"Pinagpala Cafe" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - Pinagpala Cafe ☕',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(to right, #A5724A, #7A4E2A); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px solid #A5724A; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #A5724A; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Pinagpala Cafe! ☕</h1>
            </div>
            <div class="content">
              <p>Hi ${firstName},</p>
              <p>Thank you for registering with Pinagpala Cafe! Please verify your email address using the OTP code below:</p>
              
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
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}