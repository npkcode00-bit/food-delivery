import mongoose from 'mongoose';

const PaymentInfoSchema = new mongoose.Schema(
  {
    provider: String,             // e.g., 'paymongo'
    intentId: String,             // CheckoutIntent _id as string
    checkoutSessionId: String,    // PayMongo session id
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },

    // flattened customer/contact fields
    name: String,
    phone: String,
    streetAddress: String,
    city: String,
    country: { type: String, default: 'PH' },

    // persist order method on the order
    orderMethod: {
      type: String,
      enum: ['pickup', 'dine_in', 'delivery'],
      default: 'pickup',
      index: true,
    },

    cartProducts: { type: Array, required: true, default: [] },
    totalPrice: { type: Number, required: true },

    status: {
      type: String,
      enum: [
        // Common statuses
        'placed',
        'in_kitchen',
        'cancelled',

        // Delivery-specific
        'on_the_way',
        'delivered',

        // Pickup-specific
        'ready_for_pickup',
        'picked_up',

        // Dine-in-specific
        'served',
        'completed',
      ],
      default: 'placed',
      index: true,
    },

    paid: { type: Boolean, default: false, index: true },
    paidAt: Date,

    paymentInfo: PaymentInfoSchema,

    notes: String,

    // ✅ Rider-related fields
    riderId: { type: String },            // we’ll store user._id or email here
    riderName: { type: String },
    riderEmail: { type: String },
    riderDeclined: [{ type: String }],    // optional list of riderIds who declined

    // ✅ Proof of delivery
    deliveryProofUrl: { type: String },   // image URL
    deliveredAt: { type: Date },          // when rider completed delivery

    // ✅ Archive fields
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
    },
    archivedBy: {
      type: String, // email of who archived it
    },
  },
  { timestamps: true, strict: true }
);

// Make finalization idempotent if you want (safe with sparse)
OrderSchema.index({ 'paymentInfo.intentId': 1 }, { unique: true, sparse: true });
OrderSchema.index({ createdAt: -1 });

export const Order =
  mongoose.models.Order || mongoose.model('Order', OrderSchema);
