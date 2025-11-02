// app/api/orders/route.js
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import { Order } from '../../models/Order';
import { CheckoutIntent } from '../../models/CheckoutIntent';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function isAdmin(session) {
  return session?.user?.role === 'admin' || session?.user?.admin === true;
}
function isAccounting(session) {
  return session?.user?.role === 'accounting' || session?.user?.accounting === true;
}
function isCashier(session) {
  return session?.user?.role === 'cashier' || session?.user?.cashier === true;
}
function isStaff(session) {
  return isAdmin(session) || isCashier(session) || isAccounting(session);
}

function basicAuthHeader() {
  const secret = process.env.PAYMONGO_SECRET_KEY;
  if (!secret) throw new Error('PAYMONGO_SECRET_KEY missing');
  const auth = Buffer.from(`${secret}:`).toString('base64');
  return { Authorization: `Basic ${auth}`, Accept: 'application/json' };
}

async function fetchCheckoutSession(id) {
  const headers = basicAuthHeader();
  const url = `https://api.paymongo.com/v1/checkout_sessions/${id}`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  if (!resp.ok) throw new Error('PayMongo: failed to retrieve checkout_session');
  return data?.data;
}

async function fetchPayment(id) {
  const headers = basicAuthHeader();
  const url = `https://api.paymongo.com/v1/payments/${id}`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  if (!resp.ok) return null;
  return data?.data;
}

async function fetchPaymentIntent(id) {
  const headers = basicAuthHeader();
  const url = `https://api.paymongo.com/v1/payment_intents/${id}`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  if (!resp.ok) return null;
  return data?.data;
}

async function isCheckoutSessionPaid(checkoutSessionId) {
  if (!checkoutSessionId) return false;
  const cs = await fetchCheckoutSession(checkoutSessionId);
  const attrs = cs?.attributes || {};
  const payments = Array.isArray(attrs.payments) ? attrs.payments : [];

  for (const p of payments) {
    let paymentObj = null;
    if (typeof p === 'string') paymentObj = await fetchPayment(p);
    else if (p?.attributes) paymentObj = p;
    else if (p?.id) paymentObj = await fetchPayment(p.id);

    const status = paymentObj?.attributes?.status;
    if (status === 'paid') return true;
  }

  const pi = attrs.payment_intent;
  let piObj = null;
  if (typeof pi === 'string') piObj = await fetchPaymentIntent(pi);
  else if (pi?.attributes) piObj = pi;
  else if (pi?.id) piObj = await fetchPaymentIntent(pi.id);

  const piStatus = piObj?.attributes?.status;
  return piStatus === 'succeeded';
}

function normalizeOrderMethod(val) {
  if (!val) return 'pickup';
  const s = String(val).toLowerCase().replace(/-/g, '_');
  if (s === 'dinein') return 'dine_in';
  if (['pickup','dine_in','delivery'].includes(s)) return s;
  return 'pickup';
}

export async function GET(req) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  const staff = isStaff(session);
  if (!userEmail) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const intentId = searchParams.get('intent');
  const debug = searchParams.get('debug') === '1';

  // Finalize path
  if (intentId) {
    try {
      // Already created?
      let order = await Order.findOne({ 'paymentInfo.intentId': intentId });
      if (order) {
        if (!staff && order.userEmail !== userEmail) return Response.json({ error: 'Unauthorized' }, { status: 403 });
        return Response.json(debug ? { order } : order);
      }

      // Load intent
      const intent = await CheckoutIntent.findById(intentId);
      if (!intent) return Response.json({ error: 'CheckoutIntent not found' }, { status: 404 });
      if (!staff && intent.userEmail !== userEmail) return Response.json({ error: 'Unauthorized' }, { status: 403 });

      console.log('=== FINALIZING ORDER FROM INTENT ===');
      console.log('Intent ID:', intentId);
      console.log('Intent orderMethod:', intent.orderMethod);
      console.log('Intent address.fulfillment:', intent.address?.fulfillment);

      // Verify paid
      const paid = await isCheckoutSessionPaid(intent.checkoutSessionId);
      if (!paid) return Response.json({ error: 'Order not found' }, { status: 404 });

      // Normalize method - PRIORITY ORDER
      const method = normalizeOrderMethod(
        intent.orderMethod || intent?.address?.fulfillment || 'pickup'
      );
      
      console.log('Final normalized orderMethod:', method);
      console.log('====================================');

      // Create order (flatten address) with EXPLICIT orderMethod
      order = await Order.create({
        userEmail: intent.userEmail,

        name: intent.address?.name || '',
        phone: intent.address?.phone || '',
        streetAddress: intent.address?.streetAddress || '',
        city: intent.address?.city || '',
        postalCode: intent.address?.postalCode || '',
        country: intent.address?.country || 'PH',

        orderMethod: method, // 👈 EXPLICIT

        cartProducts: intent.cartProducts,
        totalPrice: intent.totalPrice,
        status: 'placed',
        paid: true,
        paymentInfo: {
          provider: 'paymongo',
          intentId: String(intent._id),
          checkoutSessionId: intent.checkoutSessionId || null,
        },
      });

      console.log('Order created:', {
        id: order._id,
        orderMethod: order.orderMethod,
        userEmail: order.userEmail
      });

      // Optional: mark intent consumed/paid
      await CheckoutIntent.findByIdAndUpdate(intentId, {
        status: 'consumed',
        orderId: order._id,
      });

      return Response.json(debug ? { order } : order);
    } catch (err) {
      console.error('[Orders GET finalize] Error:', err);
      return Response.json({ error: 'Finalize failed' }, { status: 500 });
    }
  }

  // List
  const orders = staff
    ? await Order.find().sort({ createdAt: -1 }).lean()
    : await Order.find({ userEmail }).sort({ createdAt: -1 }).lean();

  return Response.json(orders, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function PATCH(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!isStaff(session)) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  const { orderId, status } = await req.json();
  if (!orderId || !status) return Response.json({ error: 'Order ID and status are required' }, { status: 400 });

  const updatedOrder = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
  if (!updatedOrder) return Response.json({ error: 'Order not found' }, { status: 404 });

  return Response.json({ ok: true, status, order: updatedOrder });
}

export async function PUT(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { orderId } = await req.json();
  if (!orderId) return Response.json({ error: 'Order ID is required' }, { status: 400 });

  const order = await Order.findById(orderId);
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (order.userEmail !== session.user.email && !isStaff(session)) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  order.paid = true;
  await order.save();
  return Response.json({ success: true, order });
}

export async function DELETE(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const _id = searchParams.get('_id');
  if (!_id) return Response.json({ error: 'Order ID is required' }, { status: 400 });

  const result = await Order.deleteOne({ _id });
  if (result.deletedCount === 0) return Response.json({ error: 'Order not found' }, { status: 404 });

  return Response.json({ success: true });
}