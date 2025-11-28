// app/api/checkout/route.js
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

function normalizeOrderMethod(val) {
  if (!val) return 'pickup';
  const s = String(val).toLowerCase().replace(/-/g, '_');
  if (s === 'dinein') return 'dine_in';
  if (['pickup', 'dine_in', 'delivery'].includes(s)) return s;
  return 'pickup';
}

// Normalize PH mobile number to 10 digits starting with 9 (local part)
function normalizePhPhone(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  if (digits.length === 10 && digits.startsWith('9')) {
    return digits;
  }

  return digits;
}

export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const { cartProducts = [], address = {} } = body;

    const orderMethod = normalizeOrderMethod(
      body.orderMethod || address.orderMethod || address.fulfillment || 'pickup'
    );

    if (!Array.isArray(cartProducts) || cartProducts.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // -------- Get user info from NextAuth session --------
    let userEmail = '';
    let userName = '';
    let userPhone = '';

    try {
      const session = await getServerSession(authOptions);

      userEmail = session?.user?.email || '';

      const fullNameFromParts = [
        session?.user?.firstName,
        session?.user?.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      userName = session?.user?.name || fullNameFromParts || '';
      userPhone = session?.user?.phone || '';
    } catch {
      // ignore if no session
    }

    // Email priority: session -> address.email -> body.email
    const billingEmail = userEmail || address?.email || body?.email || '';
    if (!billingEmail) {
      return Response.json(
        { error: 'Email is required for checkout' },
        { status: 400 }
      );
    }

    // Name priority: session full name -> fallback "Customer"
    const billingName = userName || 'Customer';

    // Phone priority: checkout phone (address.phone) -> profile phone
    const billingPhone = normalizePhPhone(address?.phone || userPhone || '');

    // ✅ FIXED: Properly combine street + barangay + city + province (NO country in address string)
    const street = address?.streetAddress || '';
    const barangay = address?.barangay || '';
    const city = address?.city || 'San Mateo';
    const province = address?.province || 'Rizal';
    
    // Build full address: "street, barangay, city, province" (4 parts only)
    const fullAddress = [street, barangay, city, province]
      .filter(Boolean)
      .join(', ');

    // -------- Build line items & total --------
    const lineItems = [];
    const enrichedCartProducts = [];
    let totalPrice = 0;

    for (const cartProduct of cartProducts) {
      const productInfo = await MenuItem.findById(cartProduct._id).lean();
      if (!productInfo) {
        return Response.json({ error: 'Product not found' }, { status: 400 });
      }

      let productPrice = Number(productInfo.basePrice) || 0;

      const enrichedProduct = {
        _id: String(cartProduct._id),
        name: cartProduct.name || productInfo.name || 'Item',
        basePrice: Number(productInfo.basePrice) || 0,
        size: null,
        extras: [],
      };

      // Size
      if (cartProduct.size?._id) {
        const sizeInfo = productInfo.sizes?.find(
          (s) => String(s._id) === String(cartProduct.size._id)
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

      // Extras
      if (Array.isArray(cartProduct.extras) && cartProduct.extras.length) {
        for (const extra of cartProduct.extras) {
          const extraInfo = productInfo.extraIngredientPrices?.find(
            (e) => String(e._id) === String(extra._id)
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
        description: productInfo.description
          ? String(productInfo.description).slice(0, 250)
          : undefined,
        quantity: 1,
      });
    }

    // Delivery fee only if delivery
    const DELIVERY_FEE_PHP = Number(process.env.DELIVERY_FEE_PHP || 50);
    if (orderMethod === 'delivery' && DELIVERY_FEE_PHP > 0) {
      lineItems.push({
        amount: toCentavos(DELIVERY_FEE_PHP),
        currency: 'PHP',
        name: 'Delivery fee',
        quantity: 1,
      });
      totalPrice += DELIVERY_FEE_PHP;
    }

    // -------- Create CheckoutIntent --------
    const intent = await CheckoutIntent.create({
      userEmail: billingEmail,
      address: {
        name: billingName,
        phone: billingPhone,
        streetAddress: fullAddress,  // ✅ "street, barangay, city, province"
        city: city,
        country: address?.country || 'PH',
        email: billingEmail,
        fulfillment: address?.fulfillment || undefined,
      },
      orderMethod,
      cartProducts: enrichedCartProducts,
      lineItems,
      totalPrice,
      status: 'open',
    });

    const intentId = String(intent._id);

    // -------- Base URL for redirects --------
    const envOrigin =
      process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    const origin = envOrigin || new URL(req.url).origin;
    const base = origin.endsWith('/') ? origin : origin + '/';

    // -------- PayMongo checkout session payload --------
    const payload = {
      data: {
        attributes: {
          payment_method_types: ['gcash'],
          description: `CheckoutIntent ${intentId}`,
          reference_number: intentId,
          metadata: {
            intentId,
            orderMethod,
          },
          line_items: lineItems,
          send_email_receipt: true,
          success_url: `${base}orders?intent=${intentId}&clear-cart=1`,
          cancel_url: `${base}cart?payment=failed&intent=${intentId}`,
          billing: {
            name: billingName,
            email: billingEmail,
            phone: billingPhone,
            address: {
              line1: fullAddress,  // ✅ "street, barangay, city, province"
              city: city,
              country: 'PH',
            },
          },
        },
      },
    };

    const secret = process.env.PAYMONGO_SECRET_KEY;
    if (!secret) {
      return Response.json(
        { error: 'PAYMONGO_SECRET_KEY missing' },
        { status: 500 }
      );
    }
    const auth = Buffer.from(`${secret}:`).toString('base64');

    const resp = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('PayMongo error:', data);
      return Response.json(
        { error: 'PayMongo checkout failed', details: data },
        { status: 502 }
      );
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    const checkoutSessionId = data?.data?.id;

    if (!checkoutUrl) {
      return Response.json(
        { error: 'No checkout_url from PayMongo' },
        { status: 502 }
      );
    }

    if (checkoutSessionId) {
      await CheckoutIntent.findByIdAndUpdate(intentId, { checkoutSessionId });
    }

    return Response.json(checkoutUrl);
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}