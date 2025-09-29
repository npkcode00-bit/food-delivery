import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { Category } from '../../../models/Category';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// Force Node runtime (NextAuth doesn't run on edge)
export const runtime = 'nodejs';

// Simple connect helper to avoid reconnecting
async function dbConnect() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGO_URL);
}

export async function GET() {
  await dbConnect();
  const list = await Category.find();
  return NextResponse.json(list, { status: 200 });
}

export async function POST(req) {
  await dbConnect();
  
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.admin;
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const categoryDoc = await Category.create({ name: name.trim() });
  return NextResponse.json(categoryDoc, { status: 201 });
}

export async function PUT(req) {
  await dbConnect();
  
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.admin;
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { _id, name } = await req.json();
  if (!_id || !name) {
    return NextResponse.json({ error: 'Missing _id or name' }, { status: 400 });
  }

  await Category.updateOne({ _id }, { name: name.trim() });
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

  await Category.deleteOne({ _id });
  return NextResponse.json({ ok: true }, { status: 200 });
}