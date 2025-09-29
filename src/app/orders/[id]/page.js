'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// TODO: replace with your real auth (e.g., NextAuth useSession)
function useAuth() {
  return { isAuthenticated: true }; // change to !!session
}

export default function OrdersIndexPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [orderId, setOrderId] = useState('');

  if (!isAuthenticated) {
    return (
      <section className="max-w-xl mx-auto mt-10">
        <div className="rounded-xl border border-slate-200 p-6 bg-slate-50">
          <h3 className="font-semibold text-lg">Login required</h3>
          <p className="text-slate-600 mt-1">Sign in to view your orders.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-xl mx-auto mt-10">
      <h1 className="text-2xl font-bold">Find your order</h1>
      <p className="text-slate-600 mt-1">Enter your order ID to view details.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (orderId.trim()) router.push(`/orders/${orderId.trim()}`);
        }}
      >
        <input
          className="flex-1 px-3 py-2 border rounded-lg"
          placeholder="e.g. A1234"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
        <button className="px-4 py-2 rounded-lg bg-black text-white font-semibold">Open</button>
      </form>
    </section>
  );
}
