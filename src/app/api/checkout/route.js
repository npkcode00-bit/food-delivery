import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import { MenuItem } from '../../models/MenuItem';
import { Order } from '../../models/Order';

export const runtime = 'nodejs';

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

function toCentavos(num) {
  return Math.round(Number(num || 0) * 100);
}

export async function POST(req) {
  try {
    await dbConnect();

    const { cartProducts = [], address = {} } = await req.json();
    if (!Array.isArray(cartProducts) || cartProducts.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Get logged-in user
    let userEmail = '';
    try {
      const session = await getServerSession(authOptions);
      userEmail = session?.user?.email || '';
    } catch (err) {
      console.error('Session error:', err);
    }

    // Validate email exists (either from session or address)
    const billingEmail = userEmail || address?.email || '';
    if (!billingEmail) {
      return Response.json({ 
        error: 'Email is required for checkout' 
      }, { status: 400 });
    }

    // Persist order (unpaid)
    const orderDoc = await Order.create({
      userEmail: billingEmail,
      ...address,
      cartProducts,
      paid: false,
    });

    // Build PayMongo line items
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
      const quantity = 1;
      const name = cartProduct.name || productInfo.name || 'Item';

      lineItems.push({
        amount: unitAmount,
        currency: 'PHP',
        name,
        description: productInfo.description ? String(productInfo.description).slice(0, 250) : undefined,
        quantity,
      });
    }

    // Add delivery fee
    const DELIVERY_FEE_PHP = Number(process.env.DELIVERY_FEE_PHP || 50);
    if (DELIVERY_FEE_PHP > 0) {
      lineItems.push({
        amount: toCentavos(DELIVERY_FEE_PHP),
        currency: 'PHP',
        name: 'Delivery fee',
        quantity: 1,
      });
    }

    // URLs for redirects
    const envOrigin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    const origin = envOrigin || new URL(req.url).origin;
    const base = origin.endsWith('/') ? origin : origin + '/';

    // PayMongo Checkout Session payload
    const payload = {
      data: {
        attributes: {
          payment_method_types: ['gcash'],
          description: `Order ${orderDoc._id}`,
          reference_number: String(orderDoc._id),
          line_items: lineItems,
          send_email_receipt: true,
          success_url: `${base}orders/${orderDoc._id}?clear-cart=1`,
          cancel_url: `${base}cart?canceled=1`,
          billing: {
            name: address?.name || 'Customer',
            email: billingEmail, // CRITICAL: Must not be blank
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
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('PayMongo error:', data);
      return Response.json({ error: 'PayMongo checkout failed', details: data }, { status: 502 });
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      return Response.json({ error: 'No checkout_url from PayMongo' }, { status: 502 });
    }

    return Response.json(checkoutUrl);
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}