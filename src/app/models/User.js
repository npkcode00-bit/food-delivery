import { Schema, model, models } from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,   // unique index at DB level
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true, // DO NOT set unique here
    },

    // Profile fields (from previous step)
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // NEW: role with default
    role: {
      type: String,
      enum: ['customer', 'admin', 'accounting', 'cashier'],
      default: 'customer',
      index: true,
    },

    // Keep existing boolean for compatibility, auto-sync with role
    admin: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Ensure the unique index is created (helps in prod)
UserSchema.index({ email: 1 }, { unique: true });

// Optional convenience virtual
UserSchema.virtual('fullName').get(function () {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

// Hash password if changed
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  // Auto-sync admin flag with role
  if (this.isModified('role')) {
    this.admin = this.role === 'admin';
  }
  next();
});

export const User = models?.User || model('User', UserSchema);
