import { model, models, Schema } from "mongoose";

const CartProductSchema = new Schema({
  _id: String,
  name: String,
  basePrice: Number,
  size: {
    _id: String,
    name: String,
    price: Number,
  },
  extras: [{
    _id: String,
    name: String,
    price: Number,
  }],
}, { _id: false });

// NEW: keep what the webhook writes so GET /api/orders?intent=... can find it
const PaymentInfoSchema = new Schema({
  provider: String,           // 'paymongo'
  type: String,               // event type
  intentId: String,           // CheckoutIntent _id (string)
  checkoutSessionId: String,  // cs_...
  amount: Number,             // centavos or total from event
  currency: String,           // 'PHP'
}, { _id: false });

const OrderSchema = new Schema({
  userEmail: String,
  phone: String,
  streetAddress: String,
  postalCode: String,
  city: String,
  country: String,
  name: String,

  cartProducts: [CartProductSchema],
  totalPrice: Number,
  paid: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ['placed', 'in_kitchen', 'on_the_way', 'delivered', 'cancelled'],
    default: 'placed'
  },

  // NEW: keep paymentInfo
  paymentInfo: PaymentInfoSchema,
}, { timestamps: true });

// helpful for GET /api/orders?intent=...
OrderSchema.index({ 'paymentInfo.intentId': 1 });

export const Order = models?.Order || model('Order', OrderSchema);
