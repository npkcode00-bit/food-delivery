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

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

export const User = models?.User || model('User', UserSchema);
