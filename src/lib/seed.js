// src/lib/seed.js  (ESM)
import dotenv from 'dotenv';

// load .env.local from project root
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import dbConnect from '../app/api/lib/db.js';
import InventoryItem from '../app/models/Inventory.js';

const seed = [
  { name: 'plastic caps', category: 'packaging',
    variants: [
      { name: 'small', unit: 'pcs', stock: 100, lowStockThreshold: 20 },
      { name: 'large', unit: 'pcs', stock: 100, lowStockThreshold: 20 },
    ],
  },
  { name: 'ice cubes', category: 'ice',
    variants: [
      { name: 'per sack', unit: 'sack', stock: 5, lowStockThreshold: 1 },
      { name: 'per kilo', unit: 'kg', stock: 20, lowStockThreshold: 5 },
    ],
  },
  { name: 'paper plate', category: 'packaging',
    variants: [{ name: 'for snacks', unit: 'plate', stock: 200, lowStockThreshold: 50 }],
  },
  { name: 'sago', category: 'toppings',
    variants: [
      { name: 'milk tea', unit: 'pack', stock: 10, lowStockThreshold: 2 },
      { name: 'fruit tea', unit: 'pack', stock: 10, lowStockThreshold: 2 },
    ],
  },
  { name: 'powders', category: 'powders',
    variants: [
      { name: 'chocolate', unit: 'pack', stock: 8, lowStockThreshold: 2 },
      { name: 'matcha', unit: 'pack', stock: 6, lowStockThreshold: 2 },
      { name: 'mocha', unit: 'pack', stock: 6, lowStockThreshold: 2 },
      { name: 'caramel', unit: 'pack', stock: 6, lowStockThreshold: 2 },
      { name: 'coffee', unit: 'pack', stock: 6, lowStockThreshold: 2 },
    ],
  },
  { name: 'fruit tea flavors', category: 'syrups',
    variants: [
      { name: 'blueberry', unit: 'bottle', stock: 3, lowStockThreshold: 1 },
      { name: 'strawberry', unit: 'bottle', stock: 3, lowStockThreshold: 1 },
      { name: 'mango', unit: 'bottle', stock: 3, lowStockThreshold: 1 },
      { name: 'lychee', unit: 'bottle', stock: 3, lowStockThreshold: 1 },
    ],
  },
  { name: 'snacks', category: 'snacks',
    variants: [
      { name: 'nachos', unit: 'pack', stock: 10, lowStockThreshold: 2 },
      { name: 'fries', unit: 'pack', stock: 20, lowStockThreshold: 5 },
      { name: 'patty', unit: 'pack', stock: 12, lowStockThreshold: 3 },
      { name: 'donut', unit: 'pcs', stock: 24, lowStockThreshold: 6 },
    ],
  },
  { name: 'add-ons', category: 'toppings',
    variants: [
      { name: 'cheesecake', unit: 'tub', stock: 4, lowStockThreshold: 1 },
      { name: 'coffee jelly', unit: 'tub', stock: 3, lowStockThreshold: 1 },
      { name: 'oreo', unit: 'pack', stock: 10, lowStockThreshold: 2 },
      { name: 'espresso', unit: 'shot', stock: 50, lowStockThreshold: 10 },
      { name: 'soda', unit: 'bottle', stock: 12, lowStockThreshold: 3 },
      { name: 'cheese', unit: 'pack', stock: 8, lowStockThreshold: 2 },
    ],
  },
];

(async () => {
  try {
    await dbConnect();
    await InventoryItem.deleteMany({});
    await InventoryItem.insertMany(seed);
    console.log(`✅ Seeded ${seed.length} inventory items.`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  }
})();
