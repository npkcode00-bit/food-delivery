// src/app/components/AdminOrderNotifications.js
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

  // Error/Backoff controls
  const offlineToastShownRef = useRef(false);
  const backoffMsRef = useRef(5000);          // start: 5s
  const nextAllowedRef = useRef(0);           // next timestamp allowed to poll
  const MAX_BACKOFF_MS = 60000;               // cap at 60s

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

  // ✅ NEW: Format timestamp helper
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Unknown';
    }
  };

  useEffect(() => {
    if (!isStaff || status !== 'authenticated') return;

    let cancelled = false;

    // small helper: only run if backoff window has elapsed
    const canRunNow = () => Date.now() >= nextAllowedRef.current;

    const scheduleBackoff = (multiplier = 2) => {
      backoffMsRef.current = Math.min(
        backoffMsRef.current * multiplier,
        MAX_BACKOFF_MS
      );
      nextAllowedRef.current = Date.now() + backoffMsRef.current;
    };

    const resetBackoff = () => {
      backoffMsRef.current = 5000;
      nextAllowedRef.current = Date.now() + backoffMsRef.current;
    };

    // Show a single persistent "offline" toast, dismiss on recovery
    const showOfflineToastOnce = (msg = 'Orders backend unreachable. Retrying…') => {
      if (offlineToastShownRef.current) return;
      offlineToastShownRef.current = true;
      toast.error(msg, { id: 'orders-offline', duration: Infinity, position: 'top-right' });
    };
    const hideOfflineToast = () => {
      if (!offlineToastShownRef.current) return;
      offlineToastShownRef.current = false;
      toast.dismiss('orders-offline');
    };

    const parseMaybeJson = async (res) => {
      const ct = res.headers.get('content-type') || '';
      const text = await res.text();
      if (ct.includes('application/json')) {
        try { return JSON.parse(text); } catch { /* fall through */ }
      }
      return { _raw: text };
    };

    const isConnectivityLikeError = (payload) => {
      const str =
        typeof payload === 'string'
          ? payload
          : JSON.stringify(payload || '');
      return /ETIMEOUT|ENOTFOUND|ECONN|Database connection failed|MongoServerError/i.test(str);
    };

    const checkForNewOrders = async () => {
      if (!canRunNow()) return;

      try {
        const res = await fetch('/api/orders', { cache: 'no-store' });

        if (!res.ok) {
          // Read body safely, detect connectivity error, then back off politely
          let body;
          try { body = await parseMaybeJson(res); } catch { body = {}; }

          const detail = body?.details || body?.error || body?._raw || `HTTP ${res.status}`;
          const connecty = isConnectivityLikeError(body);

          // Keep console noise low, but still useful
          console.warn('[AdminOrderNotifications] orders fetch failed:', res.status, connecty ? '(connectivity)' : '', detail?.slice?.(0, 180));

          // Show one persistent toast; increase backoff
          showOfflineToastOnce(connecty ? 'Cannot reach database. Retrying…' : 'Unable to load orders. Retrying…');
          scheduleBackoff(connecty ? 2 : 1.5);
          return;
        }

        // Good response: parse and proceed
        const data = await parseMaybeJson(res);
        if (!Array.isArray(data)) {
          console.warn('[AdminOrderNotifications] Expected array, got:', typeof data);
          showOfflineToastOnce('Unexpected response. Retrying…');
          scheduleBackoff(1.5);
          return;
        }
        if (cancelled) return;

        // Recovery path: dismiss offline toast and reset backoff
        hideOfflineToast();
        resetBackoff();

        // FIRST LOAD: announce up to 10 "placed" orders & mark seen
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;

          seenIdsRef.current = new Set(data.map(o => String(o?._id)));

          const placedOrders = data.filter(o => o?.status === 'placed');
          
          // ✅ NEW: Sort by creation date (oldest first)
          placedOrders.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateA - dateB; // Oldest first
          });

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
                        {/* ✅ NEW: Show creation time */}
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4, fontStyle: 'italic' }}>
                          📅 Placed: {formatTime(order.createdAt)}
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

          return; // skip diffing on first load
        }

        // SUBSEQUENT POLLS: find truly new orders (unseen)
        const currentIds = new Set(data.map(o => String(o?._id)));
        const newOrders = data.filter(o => !seenIdsRef.current.has(String(o?._id)));

        if (newOrders.length > 0) {
          for (const latestOrder of newOrders) {
            if (latestOrder?.status !== 'placed') continue; // avoid noise for edits

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
                    {/* ✅ NEW: Show creation time for new orders too */}
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4, fontStyle: 'italic' }}>
                      📅 Placed: {formatTime(latestOrder.createdAt)}
                    </div>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>
                      {latestOrder.cartProducts?.length || 0} item(s)
                    </div>
                    <div style={{ fontSize: 16, color: '#111', fontWeight: 600, marginBottom: 6 }}>
                      Total: {fmtPHP(totalPrice)}
                    </div>
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

            // try a sound (best-effort)
            try { new Audio('/notification.mp3').play().catch(() => {}); } catch {}
          }
        }

        // mark current as seen
        seenIdsRef.current = currentIds;
      } catch (err) {
        // Network/runtime error: treat like connectivity, back off
        console.warn('[AdminOrderNotifications] network error:', err?.message || err);
        showOfflineToastOnce('Connection error. Retrying…');
        scheduleBackoff(2);
      }
    };

    // Initial kick + fixed heartbeat; backoff gate controls actual calls
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