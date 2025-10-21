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
/** Staff: admin OR cashier OR accounting **/
function isStaff(session) {
  return isAdmin(session) || isCashier(session) || isAccounting(session);
}

/** PayMongo helpers (robust; handle IDs or expanded objects) **/
function basicAuthHeader() {
  const secret = process.env.PAYMONGO_SECRET_KEY;
  if (!secret) throw new Error('PAYMONGO_SECRET_KEY missing');
  const auth = Buffer.from(`${secret}:`).toString('base64');
  return { Authorization: `Basic ${auth}`, Accept: 'application/json' };
}

async function fetchCheckoutSession(id, diag) {
  const headers = basicAuthHeader();
  const url = `https://api.paymongo.com/v1/checkout_sessions/${id}`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  if (!resp.ok) {
    diag?.push?.({ step: 'fetchCheckoutSession', ok: false, url, data });
    throw new Error('PayMongo: failed to retrieve checkout_session');
  }
  diag?.push?.({ step: 'fetchCheckoutSession', ok: true, id, hasAttributes: !!data?.data?.attributes });
  return data?.data;
}
async function fetchPayment(id, diag) {
  const headers = basicAuthHeader();
  const url = `https://api.paymongo.com/v1/payments/${id}`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  if (!resp.ok) {
    diag?.push?.({ step: 'fetchPayment', ok: false, id, data });
    return null;
  }
  const status = data?.data?.attributes?.status;
  diag?.push?.({ step: 'fetchPayment', ok: true, id, status });
  return data?.data;
}
async function fetchPaymentIntent(id, diag) {
  const headers = basicAuthHeader();
  const url = `https://api.paymongo.com/v1/payment_intents/${id}`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  if (!resp.ok) {
    diag?.push?.({ step: 'fetchPaymentIntent', ok: false, id, data });
    return null;
  }
  const status = data?.data?.attributes?.status;
  diag?.push?.({ step: 'fetchPaymentIntent', ok: true, id, status });
  return data?.data;
}
async function isCheckoutSessionPaidWithDiag(checkoutSessionId, diag) {
  if (!checkoutSessionId) {
    diag?.push?.({ step: 'isPaid', ok: false, reason: 'no checkoutSessionId' });
    return false;
  }
  const cs = await fetchCheckoutSession(checkoutSessionId, diag);
  const attrs = cs?.attributes || {};

  // Check payments
  const payments = Array.isArray(attrs.payments) ? attrs.payments : [];
  diag?.push?.({ step: 'paymentsArray', count: payments.length });
  for (const p of payments) {
    let paymentObj = null;
    if (typeof p === 'string') paymentObj = await fetchPayment(p, diag);
    else if (p?.attributes) paymentObj = p;
    else if (p?.id) paymentObj = await fetchPayment(p.id, diag);

    const status = paymentObj?.attributes?.status;
    if (status === 'paid') {
      diag?.push?.({ step: 'paymentsCheck', status: 'paid', decision: 'PAID' });
      return true;
    }
  }

  // Fallback: payment_intent status
  const pi = attrs.payment_intent;
  let piObj = null;
  if (typeof pi === 'string') piObj = await fetchPaymentIntent(pi, diag);
  else if (pi?.attributes) piObj = pi;
  else if (pi?.id) piObj = await fetchPaymentIntent(pi.id, diag);

  const piStatus = piObj?.attributes?.status;
  if (piStatus === 'succeeded') {
    diag?.push?.({ step: 'paymentIntentCheck', status: 'succeeded', decision: 'PAID' });
    return true;
  }

  diag?.push?.({ step: 'isPaid', ok: false, reason: 'no paid payments and PI not succeeded' });
  return false;
}

/** ROUTES **/
export async function GET(req) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  const staff = isStaff(session);
  const admin = isAdmin(session);

  if (!userEmail) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const intentId = searchParams.get('intent');
  const debug = searchParams.get('debug') === '1';

  // FINALIZE path: /api/orders?intent=...
  if (intentId) {
    const diag = debug ? [{ step: 'start', intentId, userEmail }] : undefined;

    try {
      // Already created?
      let order = await Order.findOne({ 'paymentInfo.intentId': intentId });
      if (order) {
        if (!staff && order.userEmail !== userEmail) {
          return Response.json(debug ? { error: 'Unauthorized', diag } : { error: 'Unauthorized' }, { status: 403 });
        }
        return Response.json(debug ? { order, diag } : order);
      }

      // Load intent
      const intent = await CheckoutIntent.findById(intentId);
      if (!intent) {
        return Response.json(debug ? { error: 'CheckoutIntent not found', diag } : { error: 'CheckoutIntent not found' }, { status: 404 });
      }
      if (!staff && intent.userEmail !== userEmail) {
        return Response.json(debug ? { error: 'Unauthorized', diag } : { error: 'Unauthorized' }, { status: 403 });
      }

      // Verify paid
      const paid = await isCheckoutSessionPaidWithDiag(intent.checkoutSessionId, diag);
      if (!paid) {
        return Response.json(debug ? { error: 'Order not found', diag } : { error: 'Order not found' }, { status: 404 });
      }

      // Create order (idempotent if you add unique index on paymentInfo.intentId)
      order = await Order.create({
        userEmail: intent.userEmail,
        cartProducts: intent.cartProducts,
        address: intent.address,
        totalPrice: intent.totalPrice,
        status: 'placed',
        paid: true,
        paymentInfo: {
          provider: 'paymongo',
          intentId: String(intent._id),
          checkoutSessionId: intent.checkoutSessionId || null,
        },
      });

      await CheckoutIntent.findByIdAndUpdate(intentId, {
        status: 'consumed',
        orderId: order._id,
      });

      return Response.json(debug ? { order, diag } : order);
    } catch (err) {
      console.error('[Orders GET finalize] Error:', err);
      const body = debug ? { error: 'Finalize failed', err: String(err?.message || err) } : { error: 'Finalize failed' };
      return Response.json(body, { status: 500 });
    }
  }

  // LIST: staff (admin, cashier, accounting) sees ALL; customers see own
  const orders = staff
    ? await Order.find().sort({ createdAt: -1 })
    : await Order.find({ userEmail }).sort({ createdAt: -1 });

  return Response.json(orders);
}

export async function PATCH(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!isStaff(session)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { orderId, status } = await req.json();
  await Order.findByIdAndUpdate(orderId, { status });
  return Response.json({ ok: true, status });
}

export async function PUT(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { orderId } = await req.json();
  if (!orderId) return Response.json({ error: 'Order ID is required' }, { status: 400 });

  try {
    const order = await Order.findById(orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.userEmail !== session.user.email && !isStaff(session)) {
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
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

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
