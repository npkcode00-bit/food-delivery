'use client';

import { useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { CartContext } from '../components/AppContext';
import OrderViewsDemo from '../components/layout/OrderViewsDemo';

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const { clearCart } = useContext(CartContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pollingForIntent, setPollingForIntent] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setLoading(false);
    }
  };

  // Handle PayMongo redirect with ?intent=...&clear-cart=1
  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'authenticated') return;

    const url = new URL(window.location.href);
    const intent = url.searchParams.get('intent');
    const clear = url.searchParams.get('clear-cart');

    if (!intent) return;

    let cancelled = false;
    setPollingForIntent(true);

    (async function poll() {
      console.log('[Orders] Starting to poll for intent:', intent);
      
      // Poll for up to 2 minutes (60 attempts × 2 seconds)
      for (let i = 0; i < 60 && !cancelled; i++) {
        try {
          console.log(`[Orders] Polling attempt ${i + 1}/60 for intent ${intent}`);
          
          const res = await fetch(`/api/orders?intent=${intent}`);
          
          if (res.ok) {
            const order = await res.json();
            console.log('[Orders] Order found!', order);
            
            toast.success('Payment successful! Thank you for your order.', {
              duration: 5000,
            });
            
            if (clear) {
              clearCart();
              console.log('[Orders] Cart cleared');
            }

            // Remove query params
            window.history.replaceState({}, '', '/orders');
            
            // Refresh orders list
            await fetchOrders();
            setPollingForIntent(false);
            return;
          } else if (res.status === 404) {
            // Order not created yet, continue polling
            console.log('[Orders] Order not found yet, continuing to poll...');
          } else {
            // Unexpected error
            console.error('[Orders] Unexpected response:', res.status);
          }
        } catch (err) {
          console.error('[Orders] Polling error:', err);
        }
        
        // Wait 2 seconds before next attempt
        await new Promise(r => setTimeout(r, 2000));
      }
      
      // Timeout reached
      if (!cancelled) {
        console.warn('[Orders] Polling timed out after 2 minutes');
        setPollingForIntent(false);
        toast.error(
          'Payment received but order is taking longer than expected. Please refresh in a moment or contact support.',
          { duration: 8000 }
        );
        
        // Remove query params anyway
        window.history.replaceState({}, '', '/orders');
      }
    })();

    return () => {
      cancelled = true;
      setPollingForIntent(false);
    };
  }, [clearCart, status]);

  // Load orders for logged-in users
  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrders();
      // Poll every 5 seconds for updates
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [status]);

  if (loading || status === 'loading') {
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
        <button onClick={() => (window.location.href = '/login')}>Go to Login</button>
      </div>
    );
  }

  if (pollingForIntent) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <h2>Processing your payment...</h2>
        <p>Please wait while we confirm your order.</p>
        <div style={{ marginTop: 16 }}>
          <div className="spinner" style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
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

  return <OrderViewsDemo orders={orders} onOrderUpdate={fetchOrders} />;
}