// app/api/test-create-order/route.js
import mongoose from 'mongoose';
import { Order } from '../../models/Order';
import { CheckoutIntent } from '../../models/CheckoutIntent';

export async function POST(req) {
  await mongoose.connect(process.env.MONGO_URL);
  
  const { intentId } = await req.json();
  
  if (!intentId) {
    return Response.json({ error: 'intentId required' }, { status: 400 });
  }
  
  const intent = await CheckoutIntent.findById(intentId);
  
  if (!intent) {
    return Response.json({ error: 'Intent not found' }, { status: 404 });
  }
  
  // Check if order already exists
  const existing = await Order.findOne({ 'paymentInfo.intentId': intentId });
  if (existing) {
    return Response.json({ 
      message: 'Order already exists', 
      orderId: String(existing._id) 
    });
  }
  
  // Create order manually
  const order = await Order.create({
    userEmail: intent.userEmail,
    name: intent.address?.name || '',
    phone: intent.address?.phone || '',
    streetAddress: intent.address?.streetAddress || '',
    city: intent.address?.city || '',
    postalCode: intent.address?.postalCode || '',
    country: intent.address?.country || 'PH',
    cartProducts: intent.cartProducts,
    totalPrice: intent.totalPrice,
    paid: true,
    paidAt: new Date(),
    paymentInfo: {
      provider: 'paymongo',
      type: 'manual_test',
      intentId: String(intent._id),
      checkoutSessionId: intent.checkoutSessionId,
      amount: intent.totalPrice * 100,
      currency: 'PHP',
    },
  });
  
  await CheckoutIntent.findByIdAndUpdate(intentId, { status: 'paid' });
  
  return Response.json({ 
    success: true, 
    orderId: String(order._id),
    intentId: String(intent._id)
  });
}