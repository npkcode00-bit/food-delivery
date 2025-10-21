// src/app/api/inventory/[id]/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// adjust this import if your authOptions lives elsewhere
import { authOptions } from '../../auth/[...nextauth]/auth';

// shared DB + model (relative to this file)
import dbConnect from '../../lib/db';
import InventoryItem from '../../../models/Inventory';

export const runtime = 'nodejs';

function allowed(session) {
  const role = session?.user?.role;
  const isAdmin = session?.user?.admin === true || role === 'admin';
  return isAdmin || role === 'cashier';
}

// Update full item (name/category/notes/variants)
export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!allowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    await dbConnect();
    const updated = await InventoryItem.findByIdAndUpdate(params.id, body, { new: true });
    if (!updated) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error('PUT /api/inventory/[id] error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Delete item
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!allowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await dbConnect();
    const res = await InventoryItem.findByIdAndDelete(params.id);
    if (!res) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('DELETE /api/inventory/[id] error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Adjust stock for a specific variant: body = { variantId, delta }
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!allowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { variantId, delta } = await req.json() || {};
    const nDelta = Number(delta);
    if (!variantId || Number.isNaN(nDelta)) {
      return NextResponse.json({ error: 'variantId and numeric delta required' }, { status: 400 });
    }

    await dbConnect();
    const item = await InventoryItem.findById(params.id);
    if (!item) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    const variant = item.variants.id(variantId);
    if (!variant) return NextResponse.json({ error: 'Variant Not Found' }, { status: 404 });

    // never go below zero
    variant.stock = Math.max(0, (variant.stock || 0) + nDelta);

    await item.save();
    return NextResponse.json(item, { status: 200 });
  } catch (e) {
    console.error('PATCH /api/inventory/[id] error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
