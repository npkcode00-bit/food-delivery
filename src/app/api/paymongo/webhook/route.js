// app/api/paymongo/webhook/route.js
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Order } from '../../../models/Order';
import { CheckoutIntent } from '../../../models/CheckoutIntent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => {
      const [k, v] = p.trim().split('=');
      return [k, v];
    })
  );

  const t = parts.t;
  const te = parts.te || '';
  const li = parts.li || '';
  if (!t) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${rawBody}`, 'utf8')
    .digest('hex');

  for (const provided of [te, li]) {
    if (!provided || provided.length !== expected.length) continue;
    try {
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) return true;
    } catch {}
  }
  return false;
}

function normalizeOrderMethod(val) {
  if (!val) return 'pickup';
  const s = String(val).toLowerCase().replace(/-/g, '_');
  if (s === 'dinein') return 'dine_in';
  if (['pickup','dine_in','delivery'].includes(s)) return s;
  return 'pickup';
}

export async function GET() {
  return new Response('PayMongo webhook ready', { status: 200 });
}

export async function POST(req) {
  const rawBody = await req.text();

  const sig =
    req.headers.get('Paymongo-Signature') ||
    req.headers.get('paymongo-signature') ||
    req.headers.get('PAYMONGO-SIGNATURE');

  const skipVerification = process.env.SKIP_WEBHOOK_VERIFICATION === 'true';
  if (!skipVerification && !verifySignature(rawBody, sig)) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const eventType = event?.data?.attributes?.type;
  const eventData = event?.data?.attributes?.data;
  const eventDataAttrs = eventData?.attributes || {};
  const metadata = eventDataAttrs?.metadata || {};
  const referenceNumber = eventDataAttrs?.reference_number;
  const checkoutSessionId = eventData?.id;

  try {
    await dbConnect();
  } catch {
    return new Response('Database error', { status: 500 });
  }

  let intent = null;
  if (metadata.intentId) intent = await CheckoutIntent.findById(metadata.intentId);
  if (!intent && referenceNumber) intent = await CheckoutIntent.findById(referenceNumber);
  if (!intent && checkoutSessionId && eventType?.startsWith('checkout_session.')) {
    intent = await CheckoutIntent.findOne({ checkoutSessionId });
  }
  if (!intent) return new Response('Intent not found', { status: 409 });

  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Event type:', eventType);
  console.log('Intent ID:', intent._id);
  console.log('Intent orderMethod:', intent.orderMethod);
  console.log('Metadata orderMethod:', metadata.orderMethod);

  const isPaid =
    eventType === 'checkout_session.payment.paid' ||
    eventType === 'checkout_session.paid' ||
    eventType === 'payment.paid';

  if (!isPaid) {
    if (eventType === 'payment.failed') {
      await CheckoutIntent.findByIdAndUpdate(intent._id, { status: 'canceled' });
    }
    return new Response('Ignored', { status: 200 });
  }

  // Already have order?
  const existingOrder = await Order.findOne({ 'paymentInfo.intentId': String(intent._id) });
  if (existingOrder) {
    if (intent.status !== 'paid') {
      await CheckoutIntent.findByIdAndUpdate(intent._id, { status: 'paid' });
    }
    return new Response('OK - Order already exists', { status: 200 });
  }

  // PRIORITY: intent.orderMethod > metadata.orderMethod > 'pickup'
  const orderMethod = normalizeOrderMethod(
    intent.orderMethod || metadata.orderMethod || intent?.address?.fulfillment || 'pickup'
  );

  console.log('Final orderMethod for order:', orderMethod);
  console.log('=======================');

  // Create order (include orderMethod)
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const doubleCheck = await Order.findOne({
      'paymentInfo.intentId': String(intent._id),
    }).session(session);
    if (doubleCheck) {
      await session.abortTransaction();
      return new Response('OK - Order already exists', { status: 200 });
    }

    const order = await Order.create(
      [
        {
          userEmail: intent.userEmail,
          name: intent.address?.name || '',
          phone: intent.address?.phone || '',
          streetAddress: intent.address?.streetAddress || '',
          city: intent.address?.city || '',
          country: intent.address?.country || 'PH',
          cartProducts: intent.cartProducts,
          totalPrice: intent.totalPrice,
          paid: true,
          paidAt: new Date(),
          orderMethod: orderMethod, // 👈 EXPLICIT
          paymentInfo: {
            provider: 'paymongo',
            type: eventType,
            intentId: String(intent._id),
            checkoutSessionId: intent.checkoutSessionId || checkoutSessionId,
            amount: eventDataAttrs?.amount || intent.totalPrice * 100,
            currency: eventDataAttrs?.currency || 'PHP',
          },
        },
      ],
      { session }
    );

    console.log('Order created via webhook:', {
      id: order[0]._id,
      orderMethod: order[0].orderMethod,
      userEmail: order[0].userEmail
    });

    await CheckoutIntent.findByIdAndUpdate(intent._id, { status: 'paid' }, { session });
    await session.commitTransaction();
    session.endSession();

    return new Response('OK', { status: 200 });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Webhook order create error:', err);
    return new Response('Error creating order', { status: 500 });
  }
}