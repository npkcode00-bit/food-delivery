// models/InventoryItem.js
import mongoose, { Schema } from 'mongoose';

const VariantSchema = new Schema({
  name: { type: String, required: true },    // e.g. "small", "large", "per sack", "per kilo"
  unit: { type: String, default: 'pcs' },    // e.g. pcs | sack | kg | plate | bottle | pack | tub | shot
  stock: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 0 },
}, { _id: true });

const InventoryItemSchema = new Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  notes: { type: String },
  variants: { type: [VariantSchema], default: [] },
}, { timestamps: true });

export default mongoose.models.InventoryItem
  || mongoose.model('InventoryItem', InventoryItemSchema);
