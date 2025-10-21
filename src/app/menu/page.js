'use client';
import Link from "next/link";
import SectionHeaders from "../components/layout/SectionHeaders";
import MenuItem from "../components/menu/MenuItem";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const BLOCKED = new Set('accounting');

export default function MenuPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  // Redirect if blocked
  useEffect(() => {
    if (status === 'loading') return;
    if (BLOCKED.has(role)) {
      router.replace('/orders'); // or '/'
    }
  }, [status, role, router]);

  // Fetch only for allowed roles
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (BLOCKED.has(role)) return;

    Promise.all([
      fetch('/api/categories', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/menu-items', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([cats, items]) => {
      setCategories(cats || []);
      setMenuItems(items || []);
    });
  }, [status, role]);

  // While loading session, or if blocked, render nothing (or a placeholder)
  if (status === 'loading' || BLOCKED.has(role)) return null;

  return (
    <section className="max-w-7xl mx-auto mt-8">
      {categories?.length > 0 && categories.map(c => (
        <div key={c._id}>
          <div className="text-center">
            <SectionHeaders mainHeader={c.name} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-6 mb-12">
            {menuItems
              .filter(item => item.category === c._id)
              .map(item => <MenuItem key={item._id} {...item} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
