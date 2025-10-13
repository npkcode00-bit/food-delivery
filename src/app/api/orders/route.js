import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import mongoose from 'mongoose';
import { Order } from '../../models/Order';

export async function GET(req) {
  mongoose.connect(process.env.MONGO_URL);

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  const isAdmin = session?.user?.role;

  if (!userEmail) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const intentId = searchParams.get('intent');

  if (intentId) {
    const order = await Order.findOne({ 'paymentInfo.intentId': intentId });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!isAdmin && order.userEmail !== userEmail) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return Response.json(order);
  }

  const orders = isAdmin
    ? await Order.find().sort({ createdAt: -1 })
    : await Order.find({ userEmail }).sort({ createdAt: -1 });

  return Response.json(orders);
}

export async function PATCH(req) {
  mongoose.connect(process.env.MONGO_URL);

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.admin;
  if (!isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  const { orderId, status } = await req.json();
  await Order.findByIdAndUpdate(orderId, { status });
  return Response.json({ ok: true, status });
}

export async function PUT(req) {
  mongoose.connect(process.env.MONGO_URL);

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { orderId } = await req.json();
  if (!orderId) return Response.json({ error: 'Order ID is required' }, { status: 400 });

  try {
    const order = await Order.findById(orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.userEmail !== session.user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    order.paid = true;
    await order.save();
    return Response.json({ success: true, order });
  } catch (error) {
    console.error('Error marking order as paid:', error);
    return Response.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(req) {
  mongoose.connect(process.env.MONGO_URL);

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.admin;
  if (!isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const _id = searchParams.get('_id');
  if (!_id) return Response.json({ error: 'Order ID is required' }, { status: 400 });

  try {
    const result = await Order.deleteOne({ _id });
    if (result.deletedCount === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
