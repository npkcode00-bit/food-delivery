// src/app/components/AdminOrderNotifications.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

export default function AdminOrderNotifications() {
  const { data: session, status } = useSession();

  // staff = admin OR cashier
  const isAdmin =
    session?.user?.role === 'admin' || session?.user?.admin === true;
  const isCashier =
    session?.user?.role === 'cashier' || session?.user?.cashier === true;
  const isStaff = isAdmin || isCashier;

  // UI state
  const [open, setOpen] = useState(false); // bell panel open/closed
  const [pendingOrders, setPendingOrders] = useState([]); // "placed" orders
  const [hasUnread, setHasUnread] = useState(false); // show badge or not

  // Refs to manage initialization and dedup
  const hasInitializedRef = useRef(false);
  const seenIdsRef = useRef(new Set()); // track seen order IDs to detect truly new orders

  // Error/Backoff controls
  const offlineToastShownRef = useRef(false);
  const backoffMsRef = useRef(5000); // start: 5s
  const nextAllowedRef = useRef(0); // next timestamp allowed to poll
  const MAX_BACKOFF_MS = 60000; // cap at 60s
  const intervalRef = useRef(null);

  const fmtPHP = (n) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(n || 0));

  const calcTotal = (order) => {
    if (typeof order?.totalPrice === 'number') return order.totalPrice;
    if (Array.isArray(order?.cartProducts)) {
      return order.cartProducts.reduce((sum, item) => {
        let price = Number(item?.basePrice || 0);
        if (item?.size?.price) price += Number(item.size.price);
        if (Array.isArray(item?.extras)) {
          for (const extra of item.extras) {
            price += Number(extra?.price || 0);
          }
        }
        return sum + price;
      }, 0);
    }
    // legacy fallback
    if (Array.isArray(order?.items)) {
      return order.items.reduce(
        (sum, it) =>
          sum + Number(it.qty || 0) * Number(it.price || 0),
        0
      );
    }
    return 0;
  };

  // Format timestamp helper
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
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
    const showOfflineToastOnce = (
      msg = 'Orders backend unreachable. Retrying…'
    ) => {
      if (offlineToastShownRef.current) return;
      offlineToastShownRef.current = true;
      toast.error(msg, {
        id: 'orders-offline',
        duration: Infinity,
        position: 'top-right',
      });
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
        try {
          return JSON.parse(text);
        } catch {
          /* fall through */
        }
      }
      return { _raw: text };
    };

    const isConnectivityLikeError = (payload) => {
      const str =
        typeof payload === 'string'
          ? payload
          : JSON.stringify(payload || '');
      return /ETIMEOUT|ENOTFOUND|ECONN|Database connection failed|MongoServerError/i.test(
        str
      );
    };

    const checkForNewOrders = async () => {
      if (!canRunNow()) return;

      try {
        const res = await fetch('/api/orders', { cache: 'no-store' });

        if (!res.ok) {
          // Read body safely, detect connectivity error, then back off politely
          let body;
          try {
            body = await parseMaybeJson(res);
          } catch {
            body = {};
          }

          const detail =
            body?.details ||
            body?.error ||
            body?._raw ||
            `HTTP ${res.status}`;
          const connecty = isConnectivityLikeError(body);

          console.warn(
            '[AdminOrderNotifications] orders fetch failed:',
            res.status,
            connecty ? '(connectivity)' : '',
            detail?.slice?.(0, 180)
          );

          showOfflineToastOnce(
            connecty
              ? 'Cannot reach database. Retrying…'
              : 'Unable to load orders. Retrying…'
          );
          scheduleBackoff(connecty ? 2 : 1.5);
          return;
        }

        // Good response: parse and proceed
        const data = await parseMaybeJson(res);
        if (!Array.isArray(data)) {
          console.warn(
            '[AdminOrderNotifications] Expected array, got:',
            typeof data
          );
          showOfflineToastOnce('Unexpected response. Retrying…');
          scheduleBackoff(1.5);
          return;
        }
        if (cancelled) return;

        // Recovery path: dismiss offline toast and reset backoff
        hideOfflineToast();
        resetBackoff();

        // Only non-archived placed orders
        const placedOrders = data
          .filter((o) => o?.status === 'placed' && !o?.archived)
          .sort(
            (a, b) =>
              new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
          ); // oldest first

        setPendingOrders(placedOrders);

        const currentIds = new Set(
          placedOrders.map((o) => String(o?._id))
        );

        // FIRST LOAD: just mark as seen, no unread dot
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
          seenIdsRef.current = currentIds;
          setHasUnread(false);
          return;
        }

        // SUBSEQUENT POLLS: find truly new placed orders
        const newOrders = placedOrders.filter(
          (o) => !seenIdsRef.current.has(String(o?._id))
        );

        if (newOrders.length > 0 && !open) {
          // Only show unread badge if panel is closed
          setHasUnread(true);

          // tiny sound (best-effort)
          try {
            new Audio('/notification.mp3')
              .play()
              .catch(() => {});
          } catch {
            /* ignore */
          }
        }

        // mark current as seen
        seenIdsRef.current = currentIds;
      } catch (err) {
        console.warn(
          '[AdminOrderNotifications] network error:',
          err?.message || err
        );
        showOfflineToastOnce('Connection error. Retrying…');
        scheduleBackoff(2);
      }
    };

    // Initial kick + fixed heartbeat; backoff gate controls actual calls
    checkForNewOrders();
    intervalRef.current = setInterval(checkForNewOrders, 5000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStaff, status, open]);

  // Close with ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // If not staff / not logged in, show nothing
  if (!isStaff || status !== 'authenticated') return null;

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        // Mark notifications as read when opening panel
        setHasUnread(false);
      }
      return next;
    });
  };

  const count = pendingOrders.length;
  const badgeNumber = count > 99 ? '99+' : count;

  const orderMethodLabel = (m) => {
    if (m === 'delivery') return 'Delivery';
    if (m === 'dine_in') return 'Dine-in';
    return 'Pick-up';
  };

  const methodPillClasses = (m) => {
    if (m === 'delivery') return 'bg-emerald-50 text-emerald-700';
    if (m === 'dine_in') return 'bg-indigo-50 text-indigo-700';
    return 'bg-amber-50 text-amber-700';
  };

  return (
    <>
      {/* Floating bell button - TOP RIGHT */}
      <span
        onClick={toggleOpen}
        style={{ maxWidth: '52px' }}
        className="
          fixed top-24 right-6 z-40
          inline-flex h-12 w-12 items-center justify-center
          rounded-full border border-amber-100
          bg-gradient-to-br from-white via-[#FFF7ED] to-[#FDE68A]
          shadow-[0_10px_25px_rgba(0,0,0,0.08)]
          hover:shadow-[0_14px_35px_rgba(0,0,0,0.12)]
          hover:-translate-y-0.5
          transition-all duration-200
          cursor-pointer
        "
        aria-label="Order notifications"
      >
        <span className="text-xl">🔔</span>

        {/* Badge with count (only when there are new/unread pending orders) */}
        {hasUnread && count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-[3px] text-[10px] font-bold text-white shadow">
              {badgeNumber}
            </span>
          </span>
        )}
      </span>

      {/* Panel under the bell - TOP RIGHT */}
      {open && (
        <div
          className="
            fixed top-36 right-4 z-40
            w-96 max-h-[70vh] overflow-hidden
            rounded-3xl border border-zinc-200/80 bg-white/95
            shadow-2xl backdrop-blur-md
          "
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-zinc-200/70 bg-gradient-to-r from-amber-50/70 to-white px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Pending orders
              </p>
              <p className="text-xs text-zinc-600">
                {count
                  ? `${count} order${count > 1 ? 's' : ''} waiting`
                  : 'No pending orders'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {count > 0 && (
                <button
                  type="button"
                  className="
                    inline-flex items-center rounded-full
                    bg-[#8B5E34]/10 px-3 py-1
                    text-[11px] font-semibold text-[#8B5E34]
                    hover:bg-[#8B5E34]/15
                    transition-colors
                    cursor-pointer
                  "
                  onClick={() => {
                    window.location.href = '/orders';
                  }}
                >
                  Open orders
                </button>
              )}
              <span
                style={{
                  minWidth: '30px',
                  border: '1px solid black',
                  height: '30px',
                  alignContent: 'center',
                }}
                className="rounded-full text-center p-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                ✕
              </span>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto bg-gradient-to-b from-white to-zinc-50/60">
            {count === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-zinc-500">
                All caught up! 🎉
              </div>
            ) : (
              <div className="divide-y divide-zinc-100/80 gap-2 px-[10px]">
                {pendingOrders.map((order) => {
                  const total = calcTotal(order);
                  const idShort = order._id?.slice(-6).toUpperCase();
                  const methodLabel = orderMethodLabel(order.orderMethod);

                  return (
                    <button
                      key={order._id}
                      type="button"
                      className="
                        flex w-full gap-2 px-4 py-3 text-left my-[15px]
                        hover:bg-zinc-50/90 transition-colors cursor-pointer
                      "
                      onClick={() => {
                        window.location.href = '/orders';
                      }}
                    >
                      <div className="flex">
                        {/* Left accent bar */}
                        <div className="mt-0.5 mr-2 h-10 w-1 rounded-full bg-amber-300/80" />

                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-zinc-800">
                              Order #{idShort}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              {formatTime(order.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`
                                  inline-flex items-center rounded-full px-2 py-0.5
                                  text-[10px] font-semibold
                                  ${methodPillClasses(order.orderMethod)}
                                `}
                              >
                                {methodLabel}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {order.cartProducts?.length || 0} item
                                {order.cartProducts?.length === 1 ? '' : 's'}
                              </span>
                            </div>

                            <span className="text-sm font-semibold text-zinc-900">
                              {fmtPHP(total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
