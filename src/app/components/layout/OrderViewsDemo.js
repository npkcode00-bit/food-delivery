// app/components/layout/OrderViewsDemo.jsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

/* -------------------- Constants & helpers -------------------- */

// Dynamic status flows based on order method
const STATUS_FLOWS = {
  delivery: ['placed', 'in_kitchen', 'on_the_way', 'delivered'],
  pickup: ['placed', 'in_kitchen', 'ready_for_pickup', 'picked_up'],
  dine_in: ['placed', 'in_kitchen', 'served', 'completed'],
};

const STATUS_META = {
  // Common statuses
  placed: { label: 'Placed' },
  in_kitchen: { label: 'In the kitchen' },
  cancelled: { label: 'Cancelled' },
  
  // Delivery statuses
  on_the_way: { label: 'On the way' },
  delivered: { label: 'Delivered' },
  
  // Pickup statuses
  ready_for_pickup: { label: 'Ready for pickup' },
  picked_up: { label: 'Picked up' },
  
  // Dine-in statuses
  served: { label: 'Served' },
  completed: { label: 'Completed' },
};

const ORDER_METHOD_LABEL = {
  pickup: 'Pick-up',
  dine_in: 'Dine-in',
  delivery: 'Delivery',
};

const fmtTime = (iso) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

const currency = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

const getOrderMethodLabel = (m) => ORDER_METHOD_LABEL[m] || (m || '—');

// Get the appropriate status flow for an order
function getStatusFlow(orderMethod) {
  const method = orderMethod || 'pickup';
  return STATUS_FLOWS[method] || STATUS_FLOWS.pickup;
}

// Get next status in the flow
function getNextStatus(currentStatus, orderMethod) {
  const flow = getStatusFlow(orderMethod);
  const currentIndex = flow.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex >= flow.length - 1) return null;
  return flow[currentIndex + 1];
}

/* -------------------- API -------------------- */
async function updateOrderStatus(orderId, next) {
  try {
    const response = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: next }),
    });
    const data = await response.json();
    return { ok: response.ok, status: data.status, error: data.error };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function deleteOrder(orderId) {
  try {
    const response = await fetch(`/api/orders?_id=${orderId}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete order');
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/* -------------------- Tiny UI primitives -------------------- */
function Button({ children, variant = 'solid', onClick, disabled, small, style = {} }) {
  const base = {
    padding: small ? '6px 10px' : '10px 14px',
    borderRadius: 12,
    border: '1px solid',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontWeight: 600,
    background: '#111',
    color: '#fff',
    borderColor: '#111',
    ...style,
  };
  if (variant === 'outline') {
    base.background = '#fff';
    base.color = '#111';
  }
  if (variant === 'ghost') {
    base.background = 'transparent';
    base.color = '#0a7';
    base.borderColor = '#0a7';
  }
  return (
    <button style={base} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Card({ children }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        background: '#fff',
      }}
    >
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Chip({ children, tone = 'default' }) {
  const tones = {
    default: { bg: '#f1f5f9', fg: '#334155' },
    warn: { bg: '#fef3c7', fg: '#92400e' },
    info: { bg: '#e0f2fe', fg: '#075985' },
    ok: { bg: '#dcfce7', fg: '#166534' },
    danger: { bg: '#fee2e2', fg: '#991b1b' },
  };
  const { bg, fg } = tones[tone] || tones.default;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(640px, 92vw)', overflow: 'hidden' }}>
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, fontSize: 20, cursor: 'pointer', maxWidth: '30px' }}>
            ×
          </button>
        </div>
        <div style={{ padding: 16, maxHeight: '70vh', overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

/* -------------------- Feature bits -------------------- */
function StatusChip({ status }) {
  const tone =
    status === 'in_kitchen' ? 'warn' :
    ['on_the_way', 'ready_for_pickup', 'served'].includes(status) ? 'info' :
    ['delivered', 'picked_up', 'completed'].includes(status) ? 'ok' :
    status === 'cancelled' ? 'danger' : 'default';
  return <Chip tone={tone}>{STATUS_META[status]?.label || status}</Chip>;
}

function OrderMethodChip({ method }) {
  const label = getOrderMethodLabel(method);
  const tone =
    method === 'pickup'   ? 'info' :
    method === 'dine_in'  ? 'ok' :
    method === 'delivery' ? 'warn' : 'default';
  return <Chip tone={tone}>{label}</Chip>;
}

function StatusStepper({ status, orderMethod }) {
  const flow = getStatusFlow(orderMethod);
  const active = Math.max(flow.indexOf(status), 0);
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {flow.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            title={STATUS_META[s].label}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              background: i <= active ? '#111' : '#fff',
              color: i <= active ? '#fff' : '#64748b',
              border: '1px solid ' + (i <= active ? '#111' : '#cbd5e1'),
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {i + 1}
          </div>
          {i < flow.length - 1 && (
            <div style={{ width: 48, height: 2, background: i < active ? '#111' : '#e2e8f0' }} />
          )}
        </div>
      ))}
    </div>
  );
}

// Make a stable unique key for each cart line item
function makeLineKey(item, index) {
  const id = String(item._id || 'noid');
  const size = String(item.size?._id || 'nosize');
  const extras = (item.extras || []).map(e => String(e._id || e.name)).sort().join('|') || 'noextras';
  return `${id}:${size}:${extras}:${index}`;
}

function OrderDetails({ order }) {
  const total = useMemo(() => {
    if (typeof order.totalPrice === 'number') return order.totalPrice;
    if (order.cartProducts && Array.isArray(order.cartProducts)) {
      return order.cartProducts.reduce((sum, item) => {
        let itemPrice = item.basePrice || 0;
        if (item.size?.price) itemPrice += item.size.price;
        if (item.extras && Array.isArray(item.extras)) {
          item.extras.forEach(extra => { itemPrice += extra.price || 0; });
        }
        return sum + itemPrice;
      }, 0);
    }
    if (order.items && Array.isArray(order.items)) {
      return order.items.reduce((sum, it) => sum + it.qty * it.price, 0);
    }
    return 0;
  }, [order]);

  const deliveryAddress = useMemo(() => {
    if (order.deliveryAddress) return order.deliveryAddress;
    const parts = [order.streetAddress, order.city, order.postalCode, order.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [order]);

  const orderItems = useMemo(() => {
    if (order.cartProducts && Array.isArray(order.cartProducts)) {
      return order.cartProducts.map((item, index) => {
        let itemPrice = item.basePrice || 0;
        if (item.size?.price) itemPrice += item.size.price;
        if (item.extras && Array.isArray(item.extras)) {
          item.extras.forEach(extra => { itemPrice += extra.price || 0; });
        }
        let itemName = item.name || 'Unknown Item';
        if (item.size?.name) itemName += ` (${item.size.name})`;
        if (item.extras?.length) itemName += ` + ${item.extras.map(e => e.name).join(', ')}`;

        const lineId = makeLineKey(item, index);
        return { id: lineId, name: itemName, qty: 1, price: itemPrice };
      });
    }
    return (order.items || []).map((it, idx) => ({
      ...it,
      id: `${String(it.id ?? it._id ?? 'noid')}-${idx}`,
    }));
  }, [order]);

  const displayOrderMethod = order.orderMethod || 'pickup';

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ 
        padding: 12, 
        background: '#f8fafc', 
        borderRadius: 12, 
        border: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Order Method</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {getOrderMethodLabel(displayOrderMethod)}
            {!order.orderMethod && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}> (not recorded)</span>}
          </div>
        </div>
        <OrderMethodChip method={displayOrderMethod} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Order ID</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {order._id?.slice(-6).toUpperCase() || order.id}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Placed</div>
          <div>{fmtTime(order.createdAt)}</div>
        </div>

        {order.userEmail && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>Email</div>
            <div>{order.userEmail}</div>
          </div>
        )}
        {order.phone && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>Phone</div>
            <div>{order.phone}</div>
          </div>
        )}
        
        {deliveryAddress && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {displayOrderMethod === 'delivery' ? 'Delivery Address' : 'Address'}
            </div>
            <div>{deliveryAddress}</div>
          </div>
        )}
        
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Payment Status</div>
          <div>{order.paid ? '✅ Paid' : '⏳ Pending'}</div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid #e5e7eb' }} />

      <div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Items</div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {orderItems.map((it, idx) => (
            <div
              key={`${it.id}-${idx}`}
              style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #e5e7eb' }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Qty: {it.qty} × {currency(it.price)}
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>{currency(it.qty * it.price)}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12 }}>
            <div style={{ fontWeight: 600 }}>Total</div>
            <div style={{ fontWeight: 700 }}>{currency(total)}</div>
          </div>
        </div>
      </div>

      {order.notes && (
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Notes</div>
          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12, background: '#f8fafc' }}>
            {order.notes}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminActions({ order, onChange, onRefresh, onDelete, canDelete }) {
  const [loading, setLoading] = useState(null);
  const orderMethod = order.orderMethod || 'pickup';
  const flow = getStatusFlow(orderMethod);
  
  // Get button labels based on order method
  const getButtonConfig = () => {
    const currentIndex = flow.indexOf(order.status);
    const buttons = [];
    
    for (let i = currentIndex + 1; i < flow.length; i++) {
      const nextStatus = flow[i];
      const meta = STATUS_META[nextStatus];
      buttons.push({
        status: nextStatus,
        label: meta?.label || nextStatus,
        variant: i === currentIndex + 1 ? 'solid' : i === currentIndex + 2 ? 'outline' : 'ghost'
      });
    }
    
    return buttons;
  };

  const buttons = getButtonConfig();

  const go = async (next) => {
    setLoading(next);
    const res = await updateOrderStatus(order._id, next);
    setLoading(null);
    if (res.ok) {
      onChange(res.status);
      if (onRefresh) onRefresh();
    } else {
      toast.error(res.error || 'Failed to update order');
    }
  };

  const handleDelete = async () => {
    const displayId = order._id?.slice(-6).toUpperCase() || order.id;
    toast(
      (t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>Delete order #{displayId}? This cannot be undone.</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                setLoading('delete');
                const res = await deleteOrder(order._id);
                setLoading(null);
                if (res.ok) {
                  toast.success('Order deleted');
                  onDelete?.(order._id);
                  onRefresh?.();
                } else {
                  toast.error(res.error || 'Failed to delete order');
                }
              }}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #991b1b', background: '#991b1b', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: 10000, style: { minWidth: 350 } }
    );
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {buttons.map((btn) => (
        <Button
          key={btn.status}
          variant={btn.variant}
          disabled={!!loading}
          onClick={() => go(btn.status)}
        >
          {loading === btn.status ? 'Updating…' : btn.label}
        </Button>
      ))}

      {canDelete && (
        <Button
          variant="outline"
          disabled={!!loading}
          onClick={handleDelete}
          style={{ marginLeft: 'auto', background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}
        >
          {loading === 'delete' ? 'Deleting…' : 'Delete'}
        </Button>
      )}
    </div>
  );
}

/* -------------------- Main Card -------------------- */
function OrderCard({ initialOrder, role, canDelete, onRefresh, onDelete }) {
  const [order, setOrder] = useState(initialOrder);
  useEffect(() => { setOrder(initialOrder); }, [initialOrder]);
  const displayOrderId = order._id?.slice(-6).toUpperCase() || order.id || 'N/A';
  const displayOrderMethod = order.orderMethod || 'pickup';

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Order #{displayOrderId}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Placed {fmtTime(order.createdAt)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <OrderMethodChip method={displayOrderMethod} />
          <StatusChip status={order.status || 'placed'} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <StatusStepper status={order.status || 'placed'} orderMethod={displayOrderMethod} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <Button small variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('open-order-modal-' + order._id))}>
          View details
        </Button>
        {role === 'admin' && (
          <AdminActions
            order={order}
            onChange={(next) => setOrder((o) => ({ ...o, status: next }))}
            onRefresh={onRefresh}
            onDelete={onDelete}
            canDelete={canDelete}
          />
        )}
      </div>

      <ModalWrapper order={order} />
    </Card>
  );
}

function ModalWrapper({ order }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      if (e.type === 'open-order-modal-' + order._id) setOpen(true);
    };
    window.addEventListener('open-order-modal-' + order._id, handler);
    return () => window.removeEventListener('open-order-modal-' + order._id, handler);
  }, [order._id]);
  const displayOrderId = order._id?.slice(-6).toUpperCase() || order.id || 'N/A';
  return (
    <Modal open={open} onClose={() => setOpen(false)} title={`Order #${displayOrderId}`}>
      <OrderDetails order={order} />
    </Modal>
  );
}

/* -------------------- Main Component (with sidebar) -------------------- */
export default function OrderViewsDemo({ orders = [], onOrderUpdate }) {
  const { data: session } = useSession();

  const userIsAdmin   = session?.user?.role === 'admin'   || session?.user?.admin === true;
  const userIsCashier = session?.user?.role === 'cashier' || session?.user?.cashier === true;
  const userIsStaff   = userIsAdmin || userIsCashier;

  const [role, setRole] = useState('customer');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('placed');

  // Group statuses by stage for filtering
  const STATUS_GROUPS = {
    placed: ['placed'],
    in_progress: ['in_kitchen'],
    ready_out: ['on_the_way', 'ready_for_pickup', 'served'],
    completed: ['delivered', 'picked_up', 'completed'],
  };

  // Counts per group
  const counts = useMemo(() => {
    const map = { 
      placed: 0, 
      in_progress: 0, 
      ready_out: 0, 
      completed: 0,
      cancelled: 0 
    };
    
    for (const o of orders) {
      // Find which group this status belongs to
      for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
        if (statuses.includes(o.status)) {
          map[group] += 1;
          break;
        }
      }
      // Handle cancelled separately
      if (o.status === 'cancelled') {
        map.cancelled += 1;
      }
    }
    
    return map;
  }, [orders]);

  // Text search + status filter + SORT BY OLDEST FIRST
  const filteredOrders = orders
    .filter(order => {
      // Check status filter using groups
      if (statusFilter !== 'all') {
        const groupStatuses = STATUS_GROUPS[statusFilter] || [statusFilter];
        if (!groupStatuses.includes(order.status)) return false;
      }

      if (!search) return true;
      const s = search.toLowerCase().trim();

      const orderId = order._id?.slice(-6).toUpperCase() || '';
      if (orderId.includes(s.toUpperCase())) return true;

      if (order.phone?.includes(search)) return true;
      if (order.userEmail?.toLowerCase().includes(s)) return true;

      const dt = new Date(order.createdAt);
      const long = dt.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }).toLowerCase();
      const short = dt.toLocaleDateString('en-US').toLowerCase();
      if (long.includes(s) || short.includes(s)) return true;

      // Search in all possible status keywords
      const allStatusKeywords = {
        placed: ['placed', 'new', 'pending'],
        in_progress: ['kitchen', 'cooking', 'preparing', 'progress'],
        ready_out: ['ready', 'way', 'delivery', 'delivering', 'transit', 'pickup', 'served', 'out'],
        completed: ['delivered', 'picked', 'complete', 'completed', 'done', 'finished'],
        cancelled: ['cancelled', 'canceled', 'cancel'],
      };
      
      for (const [group, kws] of Object.entries(allStatusKeywords)) {
        const groupStatuses = STATUS_GROUPS[group] || [group];
        if (groupStatuses.includes(order.status) && kws.some(k => k.includes(s))) {
          return true;
        }
      }

      if (order.cartProducts && Array.isArray(order.cartProducts)) {
        const match = order.cartProducts.some(item => {
          if (item.name?.toLowerCase().includes(s)) return true;
          if (item.size?.name?.toLowerCase().includes(s)) return true;
          if (Array.isArray(item.extras)) {
            return item.extras.some(e => e.name?.toLowerCase().includes(s));
          }
          return false;
        });
        if (match) return true;
      }

      return false;
    })
    // ⭐ Sort by createdAt ASCENDING (oldest first) - FIRST ORDERS HAVE PRIORITY
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (orders.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Card>
          <div style={{ padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>No orders yet</h2>
            <p style={{ color: '#64748b' }}>Your orders will appear here once you place them.</p>
          </div>
        </Card>
      </div>
    );
  }

  const FILTERS = [
    { key: 'placed',      label: 'Placed' },
    { key: 'in_progress', label: 'In Kitchen' },
    { key: 'ready_out',   label: 'Ready/Out for Delivery' },
    { key: 'completed',   label: 'Completed' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-0" style={{ paddingTop: 16, paddingBottom: 16 }}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="md:col-span-3">
          <div className="md:hidden mb-4">
            <select
              className="w-full rounded-xl border border-[#B08B62]/60 bg-white/80 px-4 py-2 text-zinc-700 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#8B5E34]/60"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {FILTERS.map(f => (
                <option key={f.key} value={f.key}>
                  {f.label} ({counts[f.key] || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="hidden md:block sticky top-6">
            <div className="rounded-2xl border border-white/30 bg-white/60 p-3 backdrop-blur-xl">
              <h3 className="px-2 pb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">
                Status
              </h3>
              <ul className="space-y-1">
                {FILTERS.map(f => {
                  const active = statusFilter === f.key;
                  const count = counts[f.key] || 0;

                  return (
                    <li key={f.key}>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => setStatusFilter(f.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setStatusFilter(f.key);
                          }
                        }}
                        className={[
                          'block w-full select-none text-left rounded-xl px-3 py-3 outline-none transition cursor-pointer',
                          'focus-visible:ring-2 focus-visible:ring-[#8B5E34]/50',
                          active
                            ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white shadow-lg shadow-[#A5724A]/25'
                            : 'text-zinc-700 hover:bg-white/80',
                        ].join(' ')}
                        aria-pressed={active}
                      >
                        <div className="flex items-center justify-between">
                          <span>{f.label}</span>
                          <span className={active ? 'opacity-90' : 'text-zinc-500'}>
                            {count}
                          </span>
                        </div>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <main className="md:col-span-9">
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: 16,
              background: '#f8fafc',
              borderRadius: 16,
              border: '1px solid #e5e7eb',
              marginBottom: 12,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, date, items, status..."
              style={{
                flex: 1,
                minWidth: 280,
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                outline: 'none',
                fontSize: 14,
              }}
            />

            {userIsStaff && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant={role === 'customer' ? 'solid' : 'outline'} onClick={() => setRole('customer')}>
                  Customer view
                </Button>
                <Button variant={role === 'admin' ? 'solid' : 'outline'} onClick={() => setRole('admin')}>
                  Admin view
                </Button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <OrderCard
                  key={order._id}
                  initialOrder={order}
                  role={userIsStaff ? role : 'customer'}
                  canDelete={userIsAdmin}
                  onRefresh={onOrderUpdate}
                  onDelete={() => onOrderUpdate()}
                />
              ))
            ) : (
              <Card>
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                  No orders in this status.
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}