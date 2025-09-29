'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import OrderViewsDemo from '../components/layout/OrderViewsDemo';

export default function OrdersPage() {
  const { data: session, status } = useSession();
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
    if (status === 'authenticated') {
      fetchOrders();
      
      // Poll for updates every 5 seconds
      const interval = setInterval(fetchOrders, 5000);
      
      // Cleanup interval on unmount
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