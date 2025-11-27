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
      // 👇 rider added here
      enum: ['customer', 'admin', 'accounting', 'cashier', 'rider', 'superadmin'],
      default: 'customer',
      index: true,
    },

    // Convenience flags (used in session / permissions)
    admin: {
      type: Boolean,
      default: false,
      index: true,
    },
    accounting: {
      type: Boolean,
      default: false,
      index: true,
    },
    cashier: {
      type: Boolean,
      default: false,
      index: true,
    },
    rider: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Email verification
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Archive status
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ✅ Password-reset OTP
    resetOtp: {
      type: String,
      index: true,
    },
    resetOtpExpires: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Unique email index
UserSchema.index({ email: 1 }, { unique: true });

// Virtual
UserSchema.virtual('fullName').get(function () {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

// Hash password if changed + keep role flags in sync
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  if (this.isModified('role')) {
    const r = this.role;
    this.admin = r === 'admin' || r === 'superadmin';
    this.accounting = r === 'accounting';
    this.cashier = r === 'cashier';
    this.rider = r === 'rider';
  }

  next();
});

export const User = models?.User || model('User', UserSchema);
