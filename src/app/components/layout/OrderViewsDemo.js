'use client'

import React, { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

// -------------------- Constants & helpers --------------------

const STATUS_FLOW = ['placed', 'in_kitchen', 'on_the_way', 'delivered'];
const STATUS_META = {
  placed: { label: 'Placed' },
  in_kitchen: { label: 'In the kitchen' },
  on_the_way: { label: 'On the way' },
  delivered: { label: 'Delivered' },
  cancelled: { label: 'Cancelled' },
};

const fmtTime = (iso) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

const currency = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);

// -------------------- API --------------------

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
    const response = await fetch(`/api/orders?_id=${orderId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete order');
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// -------------------- Tiny UI primitives --------------------

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
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      background: '#fff',
    }}>
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
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 999,
      background: bg,
      color: fg,
      fontWeight: 600,
      fontSize: 12,
    }}>
      {children}
    </span>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'grid', placeItems: 'center', zIndex: 50,
    }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(640px, 92vw)', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, fontSize: 20, cursor: 'pointer', maxWidth:'30px' }}>×</button>
        </div>
        <div style={{ padding: 16, maxHeight: '70vh', overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

// -------------------- Feature bits --------------------

function StatusChip({ status }) {
  const tone =
    status === 'in_kitchen' ? 'warn' :
    status === 'on_the_way' ? 'info' :
    status === 'delivered' ? 'ok' :
    status === 'cancelled' ? 'danger' : 'default';
  return <Chip tone={tone}>{STATUS_META[status]?.label || status}</Chip>;
}

function StatusStepper({ status }) {
  const active = Math.max(STATUS_FLOW.indexOf(status), 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {STATUS_FLOW.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            title={STATUS_META[s].label}
            style={{
              width: 32, height: 32, borderRadius: 999,
              display: 'grid', placeItems: 'center',
              background: i <= active ? '#111' : '#fff',
              color: i <= active ? '#fff' : '#64748b',
              border: '1px solid ' + (i <= active ? '#111' : '#cbd5e1'),
              fontSize: 12, fontWeight: 700,
            }}
          >
            {i + 1}
          </div>
          {i < STATUS_FLOW.length - 1 && (
            <div style={{ width: 48, height: 2, background: i < active ? '#111' : '#e2e8f0' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function OrderDetails({ order }) {
  const total = useMemo(() => {
    if (typeof order.total === 'number') return order.total;
    if (order.cartProducts && Array.isArray(order.cartProducts)) {
      return order.cartProducts.reduce((sum, item) => sum + (item.price || 0), 0);
    }
    if (order.items && Array.isArray(order.items)) {
      return order.items.reduce((sum, it) => sum + it.qty * it.price, 0);
    }
    return 0;
  }, [order]);

  const deliveryAddress = useMemo(() => {
    if (order.deliveryAddress) return order.deliveryAddress;
    const parts = [
      order.streetAddress,
      order.city,
      order.postalCode,
      order.country
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [order]);

  const orderItems = useMemo(() => {
    if (order.cartProducts && Array.isArray(order.cartProducts)) {
      return order.cartProducts.map((item, index) => ({
        id: item._id || index,
        name: item.name || 'Unknown Item',
        qty: 1,
        price: item.price || 0
      }));
    }
    return order.items || [];
  }, [order]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
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
            <div style={{ fontSize: 12, color: '#64748b' }}>Delivery address</div>
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
          {orderItems.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Qty: {it.qty} × {currency(it.price)}</div>
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
          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12, background: '#f8fafc' }}>{order.notes}</div>
        </div>
      )}
    </div>
  );
}

function AdminActions({ order, onChange, onRefresh, onDelete }) {
  const [loading, setLoading] = useState(null);
  const canKitchen = order.status === 'placed';
  const canOnTheWay = order.status === 'in_kitchen';
  const canDeliver = order.status === 'on_the_way';

  const go = async (next) => {
    setLoading(next);
    const res = await updateOrderStatus(order._id, next);
    setLoading(null);
    if (res.ok) {
      onChange(res.status);
      if (onRefresh) onRefresh();
    } else {
      window.alert(res.error || 'Failed to update order');
    }
  };

 const handleDelete = async () => {
  const orderId = order._id?.slice(-6).toUpperCase() || order.id;
  
  // Create a custom toast with confirmation buttons
  toast((t) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        Are you sure you want to delete order #{orderId}? This action cannot be undone.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={() => toast.dismiss(t.id)}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
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
              toast.success('Order deleted successfully');
              if (onDelete) onDelete(order._id);
              if (onRefresh) onRefresh();
            } else {
              toast.error(res.error || 'Failed to delete order');
            }
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #991b1b',
            background: '#991b1b',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Delete
        </button>
      </div>
    </div>
  ), {
    duration: 10000,
    style: {
      minWidth: '350px',
    },
  });
};

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button disabled={!canKitchen || !!loading} onClick={() => go('in_kitchen')}> 
        {loading === 'in_kitchen' ? 'Updating…' : 'In the kitchen'}
      </Button>
      <Button variant="outline" disabled={!canOnTheWay || !!loading} onClick={() => go('on_the_way')}>
        {loading === 'on_the_way' ? 'Updating…' : 'On the way'}
      </Button>
      <Button variant="ghost" disabled={!canDeliver || !!loading} onClick={() => go('delivered')}>
        {loading === 'delivered' ? 'Updating…' : 'Mark delivered'}
      </Button>
      <Button 
        variant="outline" 
        disabled={!!loading} 
        onClick={handleDelete}
        style={{ 
          marginLeft: 'auto', 
          background: '#fee2e2', 
          color: '#991b1b', 
          borderColor: '#fca5a5' 
        }}
      >
        {loading === 'delete' ? 'Deleting…' : 'Delete'}
      </Button>
    </div>
  );
}

// -------------------- Main Card --------------------

function OrderCard({ initialOrder, role, onRefresh, onDelete }) {
  const [order, setOrder] = useState(initialOrder);
  const [open, setOpen] = useState(false);

  // Update local state when prop changes (from polling)
  useMemo(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  const displayOrderId = order._id?.slice(-6).toUpperCase() || order.id || 'N/A';

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Order #{displayOrderId}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Placed {fmtTime(order.createdAt)}</div>
        </div>
        <StatusChip status={order.status || 'placed'} />
      </div>

      <div style={{ marginTop: 12 }}>
        <StatusStepper status={order.status || 'placed'} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <Button small variant="outline" onClick={() => setOpen(true)}>View details</Button>
        {role === 'admin' && (
          <AdminActions 
            order={order} 
            onChange={(next) => setOrder((o) => ({ ...o, status: next }))} 
            onRefresh={onRefresh}
            onDelete={onDelete}
          />
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Order #${displayOrderId}`}>
        <OrderDetails order={order} />
      </Modal>
    </Card>
  );
}

// -------------------- Main Component --------------------

export default function OrderViewsDemo({ orders = [], onOrderUpdate }) {
  const { data: session } = useSession();
  const isAdmin = !!session?.user?.admin;
  
  const [role, setRole] = useState('customer');
  const [search, setSearch] = useState('');

  const filteredOrders = orders.filter(order => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const orderId = order._id?.slice(-6).toUpperCase() || '';
    return (
      orderId.includes(searchLower.toUpperCase()) ||
      order.phone?.includes(search) ||
      order.userEmail?.toLowerCase().includes(searchLower)
    );
  });

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

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Enter order ID or phone"
            style={{
              padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e7eb',
              outline: 'none', minWidth: 240,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant={role === 'customer' ? 'solid' : 'outline'} onClick={() => setRole('customer')}>
              Customer view
            </Button>
            <Button variant={role === 'admin' ? 'solid' : 'outline'} onClick={() => setRole('admin')}>
              Admin view
            </Button>
          </div>
        </div>
      )}

      {filteredOrders.map((order) => (
        <OrderCard 
          key={order._id} 
          initialOrder={order} 
          role={isAdmin ? role : 'customer'} 
          onRefresh={onOrderUpdate}
          onDelete={() => onOrderUpdate()}
        />
      ))}
    </div>
  );
}