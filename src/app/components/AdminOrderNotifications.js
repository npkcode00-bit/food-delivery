'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

export default function AdminOrderNotifications() {
  const { data: session, status } = useSession();

  // staff = admin OR cashier
  const isAdmin   = session?.user?.role === 'admin'   || session?.user?.admin === true;
  const isCashier = session?.user?.role === 'cashier' || session?.user?.cashier === true;
  const isStaff   = isAdmin || isCashier;

  // Refs to manage initialization and dedup
  const hasInitializedRef = useRef(false);
  const hasShownLoginNotificationRef = useRef(false);
  const seenIdsRef = useRef(new Set()); // track seen order IDs to detect truly new orders

  const fmtPHP = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n || 0));

  const calcTotal = (order) => {
    if (typeof order?.totalPrice === 'number') return order.totalPrice;
    if (Array.isArray(order?.cartProducts)) {
      return order.cartProducts.reduce((sum, item) => {
        let price = Number(item?.basePrice || 0);
        if (item?.size?.price) price += Number(item.size.price);
        if (Array.isArray(item?.extras)) {
          for (const extra of item.extras) price += Number(extra?.price || 0);
        }
        return sum + price;
      }, 0);
    }
    // legacy fallback
    if (Array.isArray(order?.items)) {
      return order.items.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0), 0);
    }
    return 0;
  };

  useEffect(() => {
    if (!isStaff || status !== 'authenticated') return;

    let cancelled = false;

    const checkForNewOrders = async () => {
      try {
        const res = await fetch('/api/orders', { cache: 'no-store' });
        if (!res.ok) {
          console.error('Failed to fetch orders:', res.status);
          return;
        }

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Expected JSON but got:', contentType);
          return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          console.error('Expected array but got:', typeof data);
          return;
        }
        if (cancelled) return;

        // FIRST LOAD: show all currently "placed" orders (up to 10), then mark all as seen
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;

          // Build seen set from current list so subsequent checks only react to truly *new* orders
          seenIdsRef.current = new Set(data.map(o => String(o?._id)));

          const placedOrders = data.filter(o => o?.status === 'placed');
          if (placedOrders.length > 0 && !hasShownLoginNotificationRef.current) {
            hasShownLoginNotificationRef.current = true;

            const ordersToShow = placedOrders.slice(0, 10);
            ordersToShow.forEach((order, index) => {
              const totalPrice = calcTotal(order);
              setTimeout(() => {
                toast.custom((t) => (
                  <div style={{
                    background: '#fff',
                    borderRadius: 12,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    padding: 20,
                    border: '2px solid #f59e0b',
                    minWidth: 320,
                    maxWidth: 420,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                      <div style={{ fontSize: 28 }}>⏳</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#111' }}>
                          Pending Order
                          {ordersToShow.length > 1 && (
                            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400, marginLeft: 6 }}>
                              ({index + 1} of {ordersToShow.length})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 15, marginBottom: 6, fontWeight: 600, color: '#f59e0b' }}>
                          Order #{order._id?.slice(-6).toUpperCase()}
                        </div>
                        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>
                          {order.cartProducts?.length || 0} item(s)
                        </div>
                        <div style={{ fontSize: 16, color: '#111', fontWeight: 600, marginBottom: 6 }}>
                          Total: {fmtPHP(totalPrice)}
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, wordBreak: 'break-word' }}>
                          Customer: {order.userEmail}
                        </div>

                        {Array.isArray(order.cartProducts) && order.cartProducts.slice(0, 2).map((item, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>
                            • {item?.name}
                          </div>
                        ))}
                        {Array.isArray(order.cartProducts) && order.cartProducts.length > 2 && (
                          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                            +{order.cartProducts.length - 2} more items
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button
                            onClick={() => { toast.dismiss(t.id); window.location.href = '/orders'; }}
                            style={{
                              flex: 1, padding: '10px 16px', borderRadius: 8,
                              background: '#f59e0b', color: '#fff', border: 'none',
                              cursor: 'pointer', fontWeight: 600, fontSize: 14,
                            }}
                          >
                            View Orders
                          </button>
                          <button
                            onClick={() => toast.dismiss(t.id)}
                            style={{
                              padding: '10px 16px', borderRadius: 8,
                              background: '#f1f5f9', color: '#64748b', border: 'none',
                              cursor: 'pointer', fontWeight: 600, fontSize: 14,
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ), { duration: Infinity, position: 'top-right' });
              }, index * 300);
            });

            if (placedOrders.length > 10) {
              setTimeout(() => {
                toast.success(`${placedOrders.length - 10} more pending orders! Check the orders page.`, {
                  duration: 5000, position: 'top-right',
                });
              }, ordersToShow.length * 300);
            }
          }

          return; // skip "new order" diffing on first load
        }

        // SUBSEQUENT POLLS: find orders not yet seen -> only notify for brand-new ones (preferably status=placed)
        const currentIds = new Set(data.map(o => String(o?._id)));
        const newOrders = data.filter(o => !seenIdsRef.current.has(String(o?._id)));
        if (newOrders.length > 0) {
          for (const latestOrder of newOrders) {
            // Only toast for new *placed* orders (avoid noise for edits)
            if (latestOrder?.status !== 'placed') continue;

            const totalPrice = calcTotal(latestOrder);

            toast.custom((t) => (
              <div style={{
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                padding: 20,
                border: '2px solid #10b981',
                minWidth: 320,
                maxWidth: 420,
              }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                  <div style={{ fontSize: 28 }}>🍕</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#111' }}>
                      🔔 New Order Received!
                    </div>
                    <div style={{ fontSize: 15, marginBottom: 6, fontWeight: 600, color: '#10b981' }}>
                      Order #{latestOrder._id?.slice(-6).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>
                      {latestOrder.cartProducts?.length || 0} item(s)
                    </div>
                    <div style={{ fontSize: 16, color: '#111', fontWeight: 600, marginBottom: 6 }}>
                      Total: {fmtPHP(totalPrice)}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, wordBreak: 'break-word' }}>
                      Customer: {latestOrder.userEmail}
                    </div>

                    {Array.isArray(latestOrder.cartProducts) && latestOrder.cartProducts.slice(0, 2).map((item, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>
                        • {item?.name}
                      </div>
                    ))}
                    {Array.isArray(latestOrder.cartProducts) && latestOrder.cartProducts.length > 2 && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                        +{latestOrder.cartProducts.length - 2} more items
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => { toast.dismiss(t.id); window.location.href = '/orders'; }}
                        style={{
                          flex: 1, padding: '10px 16px', borderRadius: 8,
                          background: '#10b981', color: '#fff', border: 'none',
                          cursor: 'pointer', fontWeight: 600, fontSize: 14,
                        }}
                      >
                        View Orders
                      </button>
                      <button
                        onClick={() => toast.dismiss(t.id)}
                        style={{
                          padding: '10px 16px', borderRadius: 8,
                          background: '#f1f5f9', color: '#64748b', border: 'none',
                          cursor: 'pointer', fontWeight: 600, fontSize: 14,
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ), { duration: Infinity, position: 'top-right' });

            // Play a sound (best-effort)
            try {
              const audio = new Audio('/notification.mp3');
              audio.play().catch(() => {});
            } catch {}
          }
        }

        // Update seen set to current
        seenIdsRef.current = currentIds;
      } catch (err) {
        console.error('Error checking for new orders:', err);
      }
    };

    // initial + every 5s
    checkForNewOrders();
    const interval = setInterval(checkForNewOrders, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isStaff, status]);

  // No UI
  return null;
}
