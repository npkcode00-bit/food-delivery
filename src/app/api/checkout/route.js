import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import { MenuItem } from '../../models/MenuItem';
import { CheckoutIntent } from '../../models/CheckoutIntent';

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

    // Get logged-in user (optional)
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
      return Response.json({ error: 'Email is required for checkout' }, { status: 400 });
    }

    // Build line items and calculate total price
    const lineItems = [];
    const enrichedCartProducts = [];
    let totalPrice = 0;

    for (const cartProduct of cartProducts) {
      const productInfo = await MenuItem.findById(cartProduct._id).lean();
      if (!productInfo) {
        return Response.json({ error: 'Product not found' }, { status: 400 });
      }

      let productPrice = Number(productInfo.basePrice) || 0;

      // Enriched product with full price info
      const enrichedProduct = {
        _id: String(cartProduct._id),
        name: cartProduct.name || productInfo.name || 'Item',
        basePrice: Number(productInfo.basePrice) || 0,
        size: null,
        extras: [],
      };

      // Size price
      if (cartProduct.size?._id) {
        const sizeInfo = productInfo.sizes?.find(
          s => String(s._id) === String(cartProduct.size._id)
        );
        if (sizeInfo) {
          const sizePrice = Number(sizeInfo.price) || 0;
          productPrice += sizePrice;
          enrichedProduct.size = {
            _id: String(sizeInfo._id),
            name: sizeInfo.name || '',
            price: sizePrice,
          };
        }
      }

      // Extras price
      if (Array.isArray(cartProduct.extras) && cartProduct.extras.length) {
        for (const extra of cartProduct.extras) {
          const extraInfo = productInfo.extraIngredientPrices?.find(
            e => String(e._id) === String(extra._id)
          );
          if (extraInfo) {
            const extraPrice = Number(extraInfo.price) || 0;
            productPrice += extraPrice;
            enrichedProduct.extras.push({
              _id: String(extraInfo._id),
              name: extraInfo.name || '',
              price: extraPrice,
            });
          }
        }
      }

      enrichedCartProducts.push(enrichedProduct);
      totalPrice += productPrice;

      lineItems.push({
        amount: toCentavos(productPrice),
        currency: 'PHP',
        name: enrichedProduct.name,
        description: productInfo.description ? String(productInfo.description).slice(0, 250) : undefined,
        quantity: 1,
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
      totalPrice += DELIVERY_FEE_PHP;
    }

    // ✅ Create a CheckoutIntent (NO Order yet)
    const intent = await CheckoutIntent.create({
      userEmail: billingEmail,
      address: {
        name: address?.name || '',
        phone: address?.phone || '',
        streetAddress: address?.streetAddress || '',
        city: address?.city || '',
        postalCode: address?.postalCode || '',
        country: address?.country || 'PH',
        email: billingEmail,
      },
      cartProducts: enrichedCartProducts,
      lineItems,
      totalPrice,
      status: 'open',
    });

    const intentId = String(intent._id);

    // URLs for redirects
    const envOrigin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    const origin = envOrigin || new URL(req.url).origin;
    const base = origin.endsWith('/') ? origin : origin + '/';

    // PayMongo Checkout Session payload
    const payload = {
      data: {
        attributes: {
          payment_method_types: ['gcash'],
          description: `CheckoutIntent ${intentId}`,
          reference_number: intentId,
          metadata: { intentId },

          line_items: lineItems,
          send_email_receipt: true,
          // ✅ FIXED: Redirect to intent page, which will show order once created
          success_url: `${base}orders?intent=${intentId}&clear-cart=1`,
          cancel_url: `${base}cart?canceled=1`,
          billing: {
            name: address?.name || 'Customer',
            email: billingEmail,
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
    const checkoutSessionId = data?.data?.id;

    if (!checkoutUrl) {
      return Response.json({ error: 'No checkout_url from PayMongo' }, { status: 502 });
    }

    // Save the PayMongo session id on the intent
    if (checkoutSessionId) {
      await CheckoutIntent.findByIdAndUpdate(intentId, { checkoutSessionId });
    }

    // Return PayMongo hosted checkout URL (frontend should redirect the browser)
    return Response.json(checkoutUrl);
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}