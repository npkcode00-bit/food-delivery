// app/orders/page.jsx
'use client';

import { Suspense } from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { CartContext } from '../components/AppContext';
import OrderViewsDemo from '../components/layout/OrderViewsDemo';

function OrdersContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useContext(CartContext) || { clearCart: () => {} };

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pollingForIntent, setPollingForIntent] = useState(false);

  const intent = searchParams.get('intent');
  const clear = searchParams.get('clear-cart');

  const DEBUG = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ordersDebug') === '1';
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('[Orders] fetchOrders error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Finalize flow: poll /api/orders?intent=... until the order exists
  useEffect(() => {
    if (status !== 'authenticated' || !intent) return;

    let cancelled = false;
    setPollingForIntent(true);

    (async () => {
      for (let i = 0; i < 60 && !cancelled; i++) {
        try {
          const url = `/api/orders?intent=${encodeURIComponent(intent)}${DEBUG ? '&debug=1' : ''}`;
          const res = await fetch(url, { cache: 'no-store' });

          if (res.ok) {
            await res.json();
            toast.success('Payment successful! Thank you for your order.', { duration: 5000 });

            if (clear) {
              try { clearCart(); } catch {}
            }

            window.history.replaceState({}, '', '/orders');
            await fetchOrders();
            setPollingForIntent(false);
            return;
          } else if (res.status !== 404) {
            try {
              const body = await res.json();
              console.warn('[Orders] finalize unexpected:', res.status, body);
            } catch {
              console.warn('[Orders] finalize unexpected:', res.status);
            }
          }
        } catch (err) {
          console.error('[Orders] finalize poll error:', err);
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      if (!cancelled) {
        setPollingForIntent(false);
        toast.error('Payment received but order creation is delayed. Please refresh shortly.');
        window.history.replaceState({}, '', '/orders');
      }
    })();

    return () => { cancelled = true; };
  }, [status, intent, clear, DEBUG]);

  // Normal list loading + background polling
  useEffect(() => {
    if (status === 'authenticated' && !intent && !pollingForIntent) {
      fetchOrders();
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    }
    if (status === 'unauthenticated') setLoading(false);
  }, [status, intent, pollingForIntent]);

  // Simple states (unchanged functionality)
  if (status === 'loading' || loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <p>Loading orders...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <h2>Please log in to view orders</h2>
        <button onClick={() => router.push('/login')}>Go to Login</button>
      </div>
    );
  }

  if (pollingForIntent) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <h2>Processing your payment...</h2>
        <p>Please wait while we confirm your order.</p>
        <div style={{ marginTop: 16 }}>
          <div
            className="spinner"
            style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #8B5E34', // brown accent
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }}
          />
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // ===== Wrapped with the same "blurred blobs + single rounded container" shell as Home =====
  return (
    <section className="relative">
      {/* Soft wallpaper blobs (brown/coffee tones to match the app) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      {/* Single rounded container (matches home) */}
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl">
        {/* Glossy top highlight */}
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        {/* Inner content padding */}
        <div className="px-6 py-10 md:px-12 md:py-14">
          <OrderViewsDemo orders={orders} onOrderUpdate={fetchOrders} />
        </div>
      </div>
    </section>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 16, textAlign: 'center' }}>
          <p>Loading orders...</p>
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
