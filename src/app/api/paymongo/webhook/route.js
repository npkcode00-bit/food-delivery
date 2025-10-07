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

export async function GET() {
  return new Response('PayMongo webhook ready', { status: 200 });
}

export async function POST(req) {
  const timestamp = new Date().toISOString();
  console.log('\n========================================');
  console.log(`[Webhook ${timestamp}] 🔔 WEBHOOK RECEIVED`);
  console.log('========================================\n');
  
  const rawBody = await req.text();

  const sig =
    req.headers.get('Paymongo-Signature') ||
    req.headers.get('paymongo-signature') ||
    req.headers.get('PAYMONGO-SIGNATURE');

  const skipVerification = process.env.SKIP_WEBHOOK_VERIFICATION === 'true';
  
  if (!skipVerification && !verifySignature(rawBody, sig)) {
    console.error('[Webhook] ❌ Invalid signature');
    return new Response('Invalid signature', { status: 400 });
  }

  if (skipVerification) {
    console.warn('[Webhook] ⚠️ SIGNATURE VERIFICATION SKIPPED');
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('[Webhook] ❌ Bad JSON');
    return new Response('Bad JSON', { status: 400 });
  }

  // Extract event data
  const eventType = event?.data?.attributes?.type;
  const eventData = event?.data?.attributes?.data;
  const eventDataAttrs = eventData?.attributes || {};
  
  console.log('[Webhook] Event type:', eventType);
  console.log('[Webhook] Event data ID:', eventData?.id);

  const metadata = eventDataAttrs?.metadata || {};
  const referenceNumber = eventDataAttrs?.reference_number;
  const checkoutSessionId = eventData?.id;

  console.log('[Webhook] Metadata intentId:', metadata.intentId);
  console.log('[Webhook] Reference number:', referenceNumber);
  console.log('[Webhook] Checkout/Payment ID:', checkoutSessionId);

  try {
    await dbConnect();
    console.log('[Webhook] ✅ Database connected');
  } catch (err) {
    console.error('[Webhook] ❌ DB error:', err.message);
    return new Response('Database error', { status: 500 });
  }

  // Find the CheckoutIntent
  let intent = null;
  
  if (metadata.intentId) {
    intent = await CheckoutIntent.findById(metadata.intentId);
  }
  
  if (!intent && referenceNumber) {
    intent = await CheckoutIntent.findById(referenceNumber);
  }
  
  if (!intent && checkoutSessionId && eventType?.startsWith('checkout_session.')) {
    intent = await CheckoutIntent.findOne({ checkoutSessionId });
  }

  if (!intent) {
    console.error('[Webhook] ❌ NO INTENT FOUND');
    return new Response('Intent not found', { status: 409 });
  }

  console.log('[Webhook] ✅ Intent found:', String(intent._id));
  console.log('[Webhook] Intent status:', intent.status);

  // Check if this is a payment event
  const isPaid =
    eventType === 'checkout_session.payment.paid' ||
    eventType === 'checkout_session.paid' ||
    eventType === 'payment.paid';

  if (isPaid) {
    console.log('\n💰 PAYMENT EVENT DETECTED\n');
    
    // 🔥 CRITICAL: Check if intent is already paid
    if (intent.status === 'paid') {
      console.log('[Webhook] ⚠️ Intent already marked as paid, checking for existing order...');
      
      const existingOrder = await Order.findOne({ 'paymentInfo.intentId': String(intent._id) });
      
      if (existingOrder) {
        console.log('[Webhook] ✅ Order already exists:', String(existingOrder._id));
        console.log('[Webhook] Duplicate webhook ignored');
        return new Response('OK - Order already exists', { status: 200 });
      }
      
      console.log('[Webhook] ⚠️ Intent paid but no order found, will create order');
    }
    
    // 🔥 CRITICAL: Double-check for existing order by intentId
    const existingOrder = await Order.findOne({ 'paymentInfo.intentId': String(intent._id) });
    if (existingOrder) {
      console.log('[Webhook] ✅ Order already exists:', String(existingOrder._id));
      
      // Mark intent as paid if not already
      if (intent.status !== 'paid') {
        await CheckoutIntent.findByIdAndUpdate(intent._id, { status: 'paid' });
        console.log('[Webhook] Updated intent status to paid');
      }
      
      return new Response('OK - Order already exists', { status: 200 });
    }

    try {
      console.log('[Webhook] 📝 Creating new order...');
      
      // 🔥 CRITICAL: Use MongoDB transaction to prevent race conditions
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Check one more time within transaction
        const doubleCheck = await Order.findOne({ 
          'paymentInfo.intentId': String(intent._id) 
        }).session(session);
        
        if (doubleCheck) {
          console.log('[Webhook] Order exists (race condition detected)');
          await session.abortTransaction();
          return new Response('OK - Order already exists', { status: 200 });
        }
        
        const order = await Order.create([{
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
            type: eventType,
            intentId: String(intent._id),
            checkoutSessionId: intent.checkoutSessionId || checkoutSessionId,
            amount: eventDataAttrs?.amount || intent.totalPrice * 100,
            currency: eventDataAttrs?.currency || 'PHP',
          },
        }], { session });

        // Mark intent as paid
        await CheckoutIntent.findByIdAndUpdate(
          intent._id, 
          { status: 'paid' },
          { session }
        );

        await session.commitTransaction();
        
        console.log('\n✅✅✅ ORDER CREATED SUCCESSFULLY! ✅✅✅');
        console.log('[Webhook] Order ID:', String(order[0]._id));
        console.log('[Webhook] User:', order[0].userEmail);
        console.log('[Webhook] Total:', order[0].totalPrice);
        
        return new Response('OK', { status: 200 });
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } catch (err) {
      console.error('\n❌ ERROR CREATING ORDER');
      console.error('[Webhook] Error:', err.message);
      console.error('[Webhook] Stack:', err.stack);
      return new Response('Error creating order', { status: 500 });
    }
  }

  if (eventType === 'payment.failed') {
    if (intent) {
      await CheckoutIntent.findByIdAndUpdate(intent._id, { status: 'canceled' });
    }
    return new Response('OK', { status: 200 });
  }

  return new Response('Ignored', { status: 200 });
}