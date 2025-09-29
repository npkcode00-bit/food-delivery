import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { MenuItem } from '../../models/MenuItem';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// NextAuth relies on Node APIs; avoid Edge.
export const runtime = 'nodejs';

// Simple connector so we don't reconnect every request
async function dbConnect() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

export async function GET() {
  await dbConnect();
  const items = await MenuItem.find();
  return NextResponse.json(items, { status: 200 });
}

export async function POST(req) {
  await dbConnect();
  
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.admin;
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();
  // Basic validation
  if (!data || typeof data !== 'object' || !data.name) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const doc = await MenuItem.create(data);
  return NextResponse.json(doc, { status: 201 });
}

export async function PUT(req) {
  await dbConnect();
  
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.admin;
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { _id, ...data } = body || {};

  if (!_id) {
    return NextResponse.json({ error: 'Missing _id' }, { status: 400 });
  }

  await MenuItem.findByIdAndUpdate(_id, data);
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req) {
  await dbConnect();
  
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.admin;
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const _id = url.searchParams.get('_id');
  if (!_id) {
    return NextResponse.json({ error: 'Missing _id' }, { status: 400 });
  }

  await MenuItem.deleteOne({ _id });
  return NextResponse.json({ ok: true }, { status: 200 });
}