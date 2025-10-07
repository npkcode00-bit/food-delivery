import mongoose from 'mongoose';

const CheckoutIntentSchema = new mongoose.Schema(
  {
    userEmail: { 
      type: String, 
      required: true,
      index: true 
    },
    address: {
      name: String,
      phone: String,
      streetAddress: String,
      city: String,
      postalCode: String,
      country: { type: String, default: 'PH' },
      email: String,
    },
    cartProducts: { 
      type: Array, 
      required: true,
      default: [] 
    },
    lineItems: { 
      type: Array, 
      default: [] 
    },
    totalPrice: { 
      type: Number, 
      required: true 
    },
    checkoutSessionId: { 
      type: String,
      index: true 
    },
    status: { 
      type: String, 
      enum: ['open', 'paid', 'canceled'], 
      default: 'open',
      index: true 
    },
  },
  { 
    timestamps: true 
  }
);

// Compound index for efficient queries
CheckoutIntentSchema.index({ userEmail: 1, status: 1 });
CheckoutIntentSchema.index({ createdAt: -1 });

export const CheckoutIntent =
  mongoose.models.CheckoutIntent || mongoose.model('CheckoutIntent', CheckoutIntentSchema);