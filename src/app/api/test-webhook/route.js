// app/api/test-webhook/route.js
import mongoose from 'mongoose';
import { Order } from '../../models/Order';
import { CheckoutIntent } from '../../models/CheckoutIntent';

export async function GET(req) {
  await mongoose.connect(process.env.MONGO_URL);
  
  const { searchParams } = new URL(req.url);
  const intentId = searchParams.get('intentId');
  
  if (!intentId) {
    return Response.json({ error: 'intentId required' }, { status: 400 });
  }
  
  const intent = await CheckoutIntent.findById(intentId);
  const order = await Order.findOne({ 'paymentInfo.intentId': intentId });
  
  return Response.json({
    intent: intent ? {
      id: String(intent._id),
      status: intent.status,
      email: intent.userEmail,
      total: intent.totalPrice
    } : null,
    order: order ? {
      id: String(order._id),
      email: order.userEmail,
      paid: order.paid,
      total: order.totalPrice
    } : null
  });
}