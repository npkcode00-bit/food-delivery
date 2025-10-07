'use client';

import { useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CartContext } from '../components/AppContext';
import OrderViewsDemo from '../components/layout/OrderViewsDemo';
import toast from 'react-hot-toast';

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const { clearCart } = useContext(CartContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      if (url.includes('clear-cart=1') || url.includes('success=1')) {
        clearCart();
        toast.success('Payment successful! Thank you for your order.');
        // Clean up the URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [clearCart]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrders();
      
      const interval = setInterval(fetchOrders, 5000);
      
      return () => clearInterval(interval);
    }
  }, [status]);

  if (loading || status === 'loading') {
    return <div style={{ padding: 16, textAlign: 'center' }}>Loading orders...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <h2>Please log in to view orders</h2>
        <button onClick={() => window.location.href = '/login'}>Go to Login</button>
      </div>
    );
  }

  return <OrderViewsDemo orders={orders} onOrderUpdate={fetchOrders} />;
}