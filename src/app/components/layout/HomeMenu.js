// components/layout/HomeMenu.jsx
'use client';

import { useEffect, useState } from 'react';
import SectionHeaders from '../layout/SectionHeaders';
import MenuItem from '../menu/MenuItem';

export default function HomeMenu() {
  const [bestSellers, setBestSellers] = useState([]);

  useEffect(() => {
    fetch('/api/menu-items')
      .then((res) => res.json())
      .then((menuItems) => setBestSellers(menuItems.slice(-3)));
  }, []);

  return (
    <section className="relative mt-10">
      {/* mac-style soft wallpaper blobs behind items */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/3 top-[-12%] h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 opacity-20 blur-3xl" />
        <div className="absolute bottom-[-16%] left-8 h-64 w-64 rounded-full bg-gradient-to-br from-rose-400 to-orange-300 opacity-20 blur-3xl" />
      </div>

      <div className="px-2 md:px-4">
        <div className="mb-6 text-center md:mb-8">
          <SectionHeaders subHeader="check out" mainHeader="Our Best Sellers" />
        </div>

        {/* NO BOXES around items */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bestSellers?.length > 0 &&
            bestSellers.map((item) => (
              <MenuItem key={item._id} {...item} />
            ))}
        </div>
      </div>
    </section>
  );
}
