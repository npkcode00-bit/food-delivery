import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import mongoose from 'mongoose';
import { Order } from '../../models/Order';

export async function GET(req) {
  mongoose.connect(process.env.MONGO_URL);
  
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  const isAdmin = session?.user?.admin;

  if (!userEmail) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let orders;
  if (isAdmin) {
    // Admin sees all orders
    orders = await Order.find().sort({ createdAt: -1 });
  } else {
    // Regular users see only their orders
    orders = await Order.find({ userEmail }).sort({ createdAt: -1 });
  }

  return Response.json(orders);
}

export async function PATCH(req) {
  mongoose.connect(process.env.MONGO_URL);
  
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.admin;

  if (!isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { orderId, status } = await req.json();
  
  await Order.findByIdAndUpdate(orderId, { status });
  
  return Response.json({ ok: true, status });
}