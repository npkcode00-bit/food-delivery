import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  otp: { type: String, required: true },
  otpExpiry: { type: Date, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Auto-delete after 10 minutes
  },
});

export const PendingUser = mongoose.models.PendingUser || mongoose.model('PendingUser', pendingUserSchema);