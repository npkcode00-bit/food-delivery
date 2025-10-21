// src/app/api/inventory/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// If you keep a central authOptions in src/lib/auth.js, prefer that:
// import { authOptions } from '@/lib/auth';
// Otherwise, adjust this relative import to wherever your authOptions is:
import { authOptions } from '../../api/auth/[...nextauth]/auth'; // <-- adjust if needed

// Use the shared DB connector in src/lib/db.js (NOT under app/api/lib)
// From this file, the relative path to src/lib/db.js is ../../../lib/db
import dbConnect from '../../../app/api/lib/db.js';

// Use the shared model in src/models/InventoryItem.js
// From this file, the relative path to src/models/InventoryItem.js is ../../../models/InventoryItem
import InventoryItem from '../../../app/models/Inventory';

// Force Node runtime (getServerSession + Mongoose won't work on Edge)
export const runtime = 'nodejs';

function allowed(session) {
  const role = session?.user?.role;
  const isAdmin = session?.user?.admin === true || role === 'admin';
  return isAdmin || role === 'cashier';
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!allowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await dbConnect();
    const items = await InventoryItem.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error('GET /api/inventory error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!allowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();

    const name = (body?.name || '').trim();
    const category = (body?.category || '').trim();
    const notes = (body?.notes || '').trim();

    if (!name || !category) {
      return NextResponse.json({ error: 'name and category are required' }, { status: 400 });
    }

    // Sanitize variants: keep only rows with a non-empty name, coerce numbers.
    const variantsInput = Array.isArray(body?.variants) ? body.variants : [];
    const variants = variantsInput
      .map(v => ({
        name: (v?.name || '').trim(),
        unit: (v?.unit || 'pcs').trim(),
        stock: Number(v?.stock || 0),
        lowStockThreshold: Number(v?.lowStockThreshold || 0),
      }))
      .filter(v => v.name.length > 0);

    await dbConnect();
    const created = await InventoryItem.create({ name, category, notes, variants });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('POST /api/inventory error:', e);
    if (e?.name === 'ValidationError') {
      return NextResponse.json({ error: 'ValidationError', details: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
