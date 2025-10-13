'use client';

import { cartProductPrice } from '../AppContext';
import Trash from '../icons/Trash';
import Image from 'next/image';

export default function CartProduct({ product, onRemove }) {
  const total = cartProductPrice(product);

  return (
    <div className="flex items-center gap-4 border-b py-4">
      <div className="w-24 shrink-0">
        <Image
          width={240}
          height={240}
          src={product.image}
          alt={product.name || 'cart product'}
          className="rounded"
        />
      </div>

      <div className="grow min-w-0">
        <h3 className="font-semibold truncate">{product.name}</h3>

        {product.size && (
          <div className="text-sm">
            Size: <span>{product.size.name}</span>
          </div>
        )}

        {product.extras?.length > 0 && (
          <div className="text-sm text-gray-500">
            {product.extras.map((extra, i) => (
              <div key={`${extra.name}-${i}`}>
                {extra.name} ${extra.price}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-lg font-semibold whitespace-nowrap">₱{total}</div>

      <div className="ml-2">
        <button
          type="button"
          onClick={onRemove}        
          className="p-2 rounded hover:bg-gray-100 cursor-pointer"
          aria-label={`Remove ${product.name}`}
          title="Remove"
        >
          <Trash />
        </button>
      </div>
    </div>
  );
}
