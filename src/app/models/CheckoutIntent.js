// models/CheckoutIntent.js
import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    streetAddress: String,
    city: String,
    postalCode: String,
    country: { type: String, default: 'PH' },
    email: String,

    // raw value from client segmented control
    fulfillment: {
      type: String, // 'pickup' | 'dinein' | 'delivery'
    },
  },
  { _id: false }
);

const CheckoutIntentSchema = new mongoose.Schema(
  {
    userEmail: {
      type: String,
      required: true,
      index: true,
    },

    address: AddressSchema,

    // persist chosen method on the intent
    orderMethod: {
      type: String,
      enum: ['pickup', 'dine_in', 'delivery'],
      default: 'pickup',
      index: true,
    },

    cartProducts: {
      type: Array,
      required: true,
      default: [],
    },

    lineItems: {
      type: Array,
      default: [],
    },

    totalPrice: {
      type: Number,
      required: true,
    },

    checkoutSessionId: {
      type: String,
      index: true,
    },

    status: {
      // include 'consumed' since we set that after creating an Order
      type: String,
      enum: ['open', 'paid', 'canceled', 'consumed'],
      default: 'open',
      index: true,
    },

    // Optional linkage when consumed
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true, strict: true }
);

// Helpful indexes
CheckoutIntentSchema.index({ userEmail: 1, status: 1 });
CheckoutIntentSchema.index({ createdAt: -1 });

export const CheckoutIntent =
  mongoose.models.CheckoutIntent ||
  mongoose.model('CheckoutIntent', CheckoutIntentSchema);
