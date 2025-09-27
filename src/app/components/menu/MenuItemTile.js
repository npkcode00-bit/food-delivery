'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AddToCartButton from './AddToCartButton';

export default function MenuItemTile({ onAddToCart, ...item }) {
  const { data: session, status } = useSession();
  const isAuthed = status === 'authenticated';

  const {
    image,
    description,
    name,
    basePrice,
    sizes,
    extraIngredientPrices,
  } = item;

  const hasSizesOrExtras =
    (sizes?.length ?? 0) > 0 || (extraIngredientPrices?.length ?? 0) > 0;

  return (
    <div
      style={{ alignContent: 'center' }}
      className="bg-gray-200 p-4 rounded-lg text-center
      group hover:bg-white hover:shadow-md hover:shadow-black/25 transition-all"
    >
      <div className="text-center">
        <img
          src={image}
          className="max-h-auto max-h-24 block mx-auto"
          alt={name || 'menu item'}
        />
      </div>

      <h4 className="font-semibold text-xl my-3">{name}</h4>

      <p className="text-gray-500 text-sm line-clamp-3">{description}</p>

      {/* Only render add-to-cart when logged in; otherwise prompt to login */}
      {isAuthed ? (
        <AddToCartButton
          image={image}
          hasSizesOrExtras={hasSizesOrExtras}
          onClick={onAddToCart}
          basePrice={basePrice}
        />
      ) : (
        <></>
      )}
    </div>
  );
}
