// lib/db.js  (or src/lib/db.js)
import mongoose from 'mongoose';

// Read either MONGO_URL or MONGODB_URI (use whichever you set in .env.local)
const MONGO = process.env.MONGO_URL || process.env.MONGODB_URI;
if (!MONGO) throw new Error('Set MONGO_URL or MONGODB_URI in .env.local');

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

export default async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO, { bufferCommands: false }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
