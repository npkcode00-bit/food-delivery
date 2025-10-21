import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import { Order } from '../../models/Order';
import { CheckoutIntent } from '../../models/CheckoutIntent';

export const runtime = 'nodejs';

async function dbConnect() {
  try {
    if (mongoose.connection.readyState >= 1) {
      console.log('✅ MongoDB already connected');
      return;
    }
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
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
  console.log('📡 Orders API GET called');
  
  try {
    // Connect to database
    await dbConnect();

    // Get session
    console.log('🔐 Getting session...');
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const staff = isStaff(session);
    const admin = isAdmin(session);

    console.log('👤 User:', userEmail, '| Staff:', staff, '| Admin:', admin);

    if (!userEmail) {
      console.log('❌ No user email in session');
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const intentId = searchParams.get('intent');
    const debug = searchParams.get('debug') === '1';

    // FINALIZE path: /api/orders?intent=...
    if (intentId) {
      console.log('🎯 Finalize path with intentId:', intentId);
      const diag = debug ? [{ step: 'start', intentId, userEmail }] : undefined;

      try {
        // Already created?
        let order = await Order.findOne({ 'paymentInfo.intentId': intentId });
        if (order) {
          console.log('✅ Order already exists:', order._id);
          if (!staff && order.userEmail !== userEmail) {
            console.log('❌ Unauthorized access attempt');
            return Response.json(debug ? { error: 'Unauthorized', diag } : { error: 'Unauthorized' }, { status: 403 });
          }
          return Response.json(debug ? { order, diag } : order);
        }

        // Load intent
        console.log('🔍 Loading CheckoutIntent...');
        const intent = await CheckoutIntent.findById(intentId);
        if (!intent) {
          console.log('❌ CheckoutIntent not found');
          return Response.json(debug ? { error: 'CheckoutIntent not found', diag } : { error: 'CheckoutIntent not found' }, { status: 404 });
        }
        if (!staff && intent.userEmail !== userEmail) {
          console.log('❌ Unauthorized intent access');
          return Response.json(debug ? { error: 'Unauthorized', diag } : { error: 'Unauthorized' }, { status: 403 });
        }

        // Verify paid
        console.log('💳 Verifying payment...');
        const paid = await isCheckoutSessionPaidWithDiag(intent.checkoutSessionId, diag);
        if (!paid) {
          console.log('❌ Payment not verified');
          return Response.json(debug ? { error: 'Order not found', diag } : { error: 'Order not found' }, { status: 404 });
        }

        // Create order (idempotent if you add unique index on paymentInfo.intentId)
        console.log('📝 Creating order...');
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
        console.log('✅ Order created:', order._id);

        await CheckoutIntent.findByIdAndUpdate(intentId, {
          status: 'consumed',
          orderId: order._id,
        });
        console.log('✅ CheckoutIntent updated');

        return Response.json(debug ? { order, diag } : order);
      } catch (err) {
        console.error('❌ [Orders GET finalize] Error:', err);
        console.error('Error stack:', err.stack);
        const body = debug 
          ? { error: 'Finalize failed', details: String(err?.message || err), stack: err.stack } 
          : { error: 'Finalize failed' };
        return Response.json(body, { status: 500 });
      }
    }

    // LIST: staff (admin, cashier, accounting) sees ALL; customers see own
    console.log('📋 Listing orders...');
    try {
      const orders = staff
        ? await Order.find().sort({ createdAt: -1 }).lean()
        : await Order.find({ userEmail }).sort({ createdAt: -1 }).lean();

      console.log(`✅ Found ${orders.length} orders`);
      
      return Response.json(orders, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    } catch (dbError) {
      console.error('❌ Database query error:', dbError);
      console.error('Error details:', {
        message: dbError.message,
        name: dbError.name,
        stack: dbError.stack,
      });
      throw dbError; // Re-throw to be caught by outer try-catch
    }
  } catch (error) {
    console.error('❌ Orders API GET Error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    // Return detailed error in development, generic in production
    const isDev = process.env.NODE_ENV === 'development';
    return Response.json(
      {
        error: 'Failed to fetch orders',
        details: isDev ? error.message : undefined,
        stack: isDev ? error.stack : undefined,
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export async function PATCH(req) {
  console.log('📡 Orders API PATCH called');
  
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    console.log('👤 User:', session?.user?.email);
    
    if (!isStaff(session)) {
      console.log('❌ Unauthorized: not staff');
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { orderId, status } = body;
    
    console.log('🔄 Updating order:', orderId, 'to status:', status);

    if (!orderId || !status) {
      return Response.json({ error: 'Order ID and status are required' }, { status: 400 });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId, 
      { status },
      { new: true }
    );

    if (!updatedOrder) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log('✅ Order updated successfully');
    return Response.json({ ok: true, status, order: updatedOrder });
  } catch (error) {
    console.error('❌ Orders API PATCH Error:', error);
    return Response.json(
      { 
        error: 'Failed to update order',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  console.log('📡 Orders API PUT called');
  
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    console.log('👤 User:', session?.user?.email);
    
    if (!session?.user?.email) {
      console.log('❌ Not authenticated');
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId } = body;
    
    if (!orderId) {
      return Response.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log('💰 Marking order as paid:', orderId);

    const order = await Order.findById(orderId);
    if (!order) {
      console.log('❌ Order not found');
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    
    if (order.userEmail !== session.user.email && !isStaff(session)) {
      console.log('❌ Unauthorized access attempt');
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    order.paid = true;
    await order.save();
    
    console.log('✅ Order marked as paid');
    return Response.json({ success: true, order });
  } catch (error) {
    console.error('❌ Orders API PUT Error:', error);
    return Response.json(
      { 
        error: 'Failed to update order',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  console.log('📡 Orders API DELETE called');
  
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    console.log('👤 User:', session?.user?.email);
    
    if (!isAdmin(session)) {
      console.log('❌ Unauthorized: not admin');
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const _id = searchParams.get('_id');
    
    if (!_id) {
      return Response.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log('🗑️ Deleting order:', _id);

    const result = await Order.deleteOne({ _id });
    
    if (result.deletedCount === 0) {
      console.log('❌ Order not found');
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log('✅ Order deleted successfully');
    return Response.json({ success: true });
  } catch (error) {
    console.error('❌ Orders API DELETE Error:', error);
    return Response.json(
      { 
        error: 'Failed to delete order',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      },
      { status: 500 }
    );
  }
}