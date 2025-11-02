import { Schema, model, models } from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },

    // Profile fields
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

    // Role management
    role: {
      type: String,
      enum: ['customer', 'admin', 'accounting', 'cashier'],
      default: 'customer',
      index: true,
    },
    admin: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ✅ NEW: Email verification status
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Ensure unique index
UserSchema.index({ email: 1 }, { unique: true });

// Virtual for full name
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