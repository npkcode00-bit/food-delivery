import {model, models, Schema} from "mongoose";

const OrderSchema = new Schema({
  userEmail: String,
  phone: String,
  streetAddress: String,
  postalCode: String,
  city: String,
  country: String,
  cartProducts: Object, // Keep this for backward compatibility
  paid: {type: Boolean, default: false},
  status: {
    type: String,
    enum: ['placed', 'in_kitchen', 'on_the_way', 'delivered', 'cancelled'],
    default: 'placed'
  },
}, {timestamps: true});

export const Order = models?.Order || model('Order', OrderSchema);