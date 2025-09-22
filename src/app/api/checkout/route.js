// src/app/api/checkout/route.js
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../api/auth/[...nextauth]/route';
import { MenuItem } from '../../models/MenuItem';
import { Order } from '../../models/Order';

export const runtime = 'nodejs'; // ensure Node runtime (not edge) for fetch to PayMongo

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function toCentavos(num) {
  // expects PHP prices in your DB; multiply by 100 -> integer centavos
  return Math.round(Number(num || 0) * 100);
}

export async function POST(req) {
  try {
    await dbConnect();

    const { cartProducts = [], address = {} } = await req.json();
    if (!Array.isArray(cartProducts) || cartProducts.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Get logged-in user (optional)
    let userEmail = '';
    try {
      const session = await getServerSession(authOptions);
      userEmail = session?.user?.email || '';
    } catch (_) {
      // ignore if authOptions not available; guest checkout still works
    }

    // Persist order (unpaid)
    const orderDoc = await Order.create({
      userEmail,
      ...address,
      cartProducts,
      paid: false,
      currency: 'PHP',
      provider: 'paymongo',
    });

    // Build PayMongo line items (PHP centavos)
    const lineItems = [];
    for (const cartProduct of cartProducts) {
      const productInfo = await MenuItem.findById(cartProduct._id).lean();
      if (!productInfo) {
        return Response.json({ error: 'Product not found' }, { status: 400 });
      }

      let productPrice = Number(productInfo.basePrice) || 0;

      // Size price
      if (cartProduct.size?._id) {
        const sizeInfo = productInfo.sizes?.find(
          s => String(s._id) === String(cartProduct.size._id)
        );
        if (sizeInfo?.price) productPrice += Number(sizeInfo.price);
      }

      // Extras price
      if (Array.isArray(cartProduct.extras) && cartProduct.extras.length) {
        for (const extra of cartProduct.extras) {
          const extraInfo = productInfo.extraIngredientPrices?.find(
            e => String(e._id) === String(extra._id)
          );
          if (extraInfo?.price) productPrice += Number(extraInfo.price);
        }
      }

      const unitAmount = toCentavos(productPrice);
      const quantity = 1; // or cartProduct.quantity ?? 1
      const name = cartProduct.name || productInfo.name || 'Item';

      lineItems.push({
        amount: unitAmount,
        currency: 'PHP',
        name,
        description: productInfo.description ? String(productInfo.description).slice(0, 250) : undefined,
        quantity,
        // images: ['https://...'] // optional
      });
    }

    // Add delivery fee (PHP). Adjust as you wish.
    const DELIVERY_FEE_PHP = Number(process.env.DELIVERY_FEE_PHP || 50); // ₱50 default
    if (DELIVERY_FEE_PHP > 0) {
      lineItems.push({
        amount: toCentavos(DELIVERY_FEE_PHP),
        currency: 'PHP',
        name: 'Delivery fee',
        quantity: 1,
      });
    }

    // Absolute URLs for redirects
    const envOrigin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    const origin = envOrigin || new URL(req.url).origin;
    const base = origin.endsWith('/') ? origin : origin + '/';

    // Build PayMongo Checkout Session payload
    const payload = {
      data: {
        attributes: {
          // Only allow GCash on the checkout
          payment_method_types: ['gcash'],
          description: `Order ${orderDoc._id}`,
          reference_number: String(orderDoc._id),
          line_items: lineItems,
          send_email_receipt: true,
          success_url: `${base}orders/${orderDoc._id}?clear-cart=1`,
          cancel_url: `${base}cart?canceled=1`,
          // Optional: prefill billing for the hosted page
          billing: {
            name: address?.name || '',
            email: userEmail || address?.email || '',
            phone: address?.phone || '',
            address: {
              line1: address?.streetAddress || '',
              city: address?.city || '',
              postal_code: address?.postalCode || '',
              country: 'PH',
            },
          },
        },
      },
    };

    // Auth header: PayMongo expects Basic auth with your SECRET key
    const secret = process.env.PAYMONGO_SECRET_KEY;
    if (!secret) {
      return Response.json({ error: 'PAYMONGO_SECRET_KEY missing' }, { status: 500 });
    }
    const auth = Buffer.from(`${secret}:`).toString('base64');

    const resp = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      // If your Node version/hosting requires, you can add: cache: 'no-store'
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('PayMongo error:', data);
      return Response.json({ error: 'PayMongo checkout failed', details: data }, { status: 502 });
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    // PayMongo Checkout Session returns a checkout_url to redirect users to. :contentReference[oaicite:1]{index=1}
    if (!checkoutUrl) {
      return Response.json({ error: 'No checkout_url from PayMongo' }, { status: 502 });
    }

    return Response.json(checkoutUrl);
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
