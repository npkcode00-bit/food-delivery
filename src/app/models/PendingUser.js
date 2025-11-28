import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { 
    type: String, 
    required: true 
  },
  firstName: { 
    type: String, 
    required: true 
  },
  lastName: { 
    type: String, 
    required: true 
  },
  address: { 
    type: String, 
    required: true 
  },
  // NEW: separate address fields
  street: {
    type: String,
    trim: true,
  },
  barangay: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    default: 'San Mateo',
    trim: true,
  },
  province: {
    type: String,
    default: 'Rizal',
    trim: true,
  },
  phone: { 
    type: String, 
    required: true 
  },
  otp: { 
    type: String, 
    required: true 
  },
  otpExpiry: { 
    type: Date, 
    required: true 
  },
  // NEW: account type
  accountType: {
    type: String,
    enum: ['customer', 'rider'],
    default: 'customer',
  },
  // NEW: rider image data (base64)
  riderImageData: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Auto-delete after 10 minutes
  },
});

export const PendingUser = mongoose.models.PendingUser || mongoose.model('PendingUser', pendingUserSchema);