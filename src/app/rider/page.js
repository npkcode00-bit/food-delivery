// app/rider/page.js
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

/* -------------------- shared helpers / tiny UI -------------------- */

const fmtTime = (iso) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

const currency = (n) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(n || 0);

const normalizeOrderMethod = (m) =>
  (m || '').toString().trim().toLowerCase();

const isDeliveryOrder = (o) => {
  const method = normalizeOrderMethod(o.orderMethod);
  return method === 'delivery' || (!method && o.deliveryAddress);
};

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

function Button({
  children,
  variant = 'solid',
  onClick,
  disabled,
  small,
  style = {},
  type = 'button',
}) {
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
    <button type={type} style={base} onClick={onClick} disabled={disabled}>
      {children}
    </button>
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
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: 'min(720px, 92vw)',
          overflow: 'hidden',
        }}
      >
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
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              fontSize: 20,
              cursor: 'pointer',
              maxWidth: '30px',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 16, maxHeight: '70vh', overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   RIDER SELF VIEW (what actual riders see)
   ===================================================================== */

async function acceptDelivery(orderId) {
  const res = await fetch('/api/rider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accept', orderId }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data.error, order: data.order };
}

async function declineDelivery(orderId) {
  const res = await fetch('/api/rider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'decline', orderId }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data.error, order: data.order };
}

async function unassignFromMe(orderId) {
  const res = await fetch('/api/rider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unassign', orderId }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data.error, order: data.order };
}

async function uploadDeliveryProof(orderId, file) {
  const fd = new FormData();
  fd.append('file', file);

  const uploadRes = await fetch('/api/upload', {
    method: 'POST',
    body: fd,
  });

  if (!uploadRes.ok) {
    const d = await uploadRes.json().catch(() => ({}));
    return { ok: false, error: d.error || 'Upload failed' };
  }

  const uploadData = await uploadRes.json();
  const link = uploadData.link;

  const patchRes = await fetch('/api/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      status: 'delivered',
      deliveryProofUrl: link,
    }),
  });

  const patchData = await patchRes.json().catch(() => ({}));
  return { ok: patchRes.ok, error: patchData.error, order: patchData.order };
}

function RiderSelfDashboard() {
  const { data: session, status } = useSession();

  const [myOrders, setMyOrders] = useState([]);
  const [unassignedDeliveries, setUnassignedDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [previewImages, setPreviewImages] = useState({});

  const riderKey =
    session?.user?.id || session?.user?._id || session?.user?.email || null;

  const upsertOrder = useCallback((updated) => {
    if (!updated?._id) return;
    setMyOrders((prev) => {
      const idx = prev.findIndex((o) => o._id === updated._id);
      if (idx === -1) {
        return [updated, ...prev];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updated };
      return copy;
    });
  }, []);

  const removeOrder = useCallback((orderId) => {
    setMyOrders((prev) => prev.filter((o) => o._id !== orderId));
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) {
      if (status === 'unauthenticated') setLoading(false);
      return;
    }

    const fetchRiderData = async () => {
      try {
        const res = await fetch('/api/rider', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load rider data');
        const data = await res.json();

        const riders = data.riders || [];

        const me = riders.find((r) => {
          if (r.email && session.user.email && 
              r.email.toLowerCase() === session.user.email.toLowerCase()) {
            return true;
          }
          if (riderKey && r._id === riderKey) {
            return true;
          }
          if (session.user.id && r._id === session.user.id) {
            return true;
          }
          return false;
        });

        if (!me) {
          console.warn('[RIDER] Could not find rider profile for current user');
          setMyOrders([]);
          setUnassignedDeliveries([]);
          setLoading(false);
          return;
        }

        const currentOrders = Array.isArray(me.currentOrders)
          ? me.currentOrders
          : [];

        setMyOrders(currentOrders);

        const unassigned = data.unassignedOrders || [];
        setUnassignedDeliveries(unassigned.filter((o) => isDeliveryOrder(o)));
      } catch (err) {
        console.error('[RiderSelfDashboard] fetchRiderData error:', err);
        toast.error('Failed to load deliveries.');
      } finally {
        setLoading(false);
      }
    };

    fetchRiderData();
    const interval = setInterval(fetchRiderData, 5000);
    return () => clearInterval(interval);
  }, [status, session, riderKey]);

  const pendingDeliveries = useMemo(
    () => unassignedDeliveries,
    [unassignedDeliveries]
  );

  const myActiveDeliveries = useMemo(
    () =>
      myOrders.filter((o) => {
        const status = (o.status || '').toLowerCase();
        return !['delivered', 'completed', 'cancelled'].includes(status);
      }),
    [myOrders]
  );

  const myCompletedDeliveries = useMemo(
    () =>
      myOrders.filter((o) => {
        const status = (o.status || '').toLowerCase();
        return ['delivered', 'completed'].includes(status);
      }),
    [myOrders]
  );

  const handleAccept = async (orderId) => {
    setActionId(orderId);
    const res = await acceptDelivery(orderId);
    setActionId(null);
    if (!res.ok) {
      toast.error(res.error || 'Failed to accept delivery.');
      return;
    }
    if (res.order) upsertOrder(res.order);
    setUnassignedDeliveries(prev => prev.filter(o => o._id !== orderId));
    toast.success('Delivery accepted – order is now on the way.');
  };

  const handleDecline = async (orderId) => {
    setActionId(orderId);
    const res = await declineDelivery(orderId);
    setActionId(null);
    if (!res.ok) {
      toast.error(res.error || 'Failed to decline delivery.');
      return;
    }
    if (res.order) upsertOrder(res.order);
    toast('You declined this delivery.', { icon: '👋' });
  };

  const handleUnassign = async (orderId) => {
    if (!confirm('Are you sure you want to unassign yourself from this delivery? It will return to the unassigned pool.')) {
      return;
    }

    setActionId(orderId);
    const res = await unassignFromMe(orderId);
    setActionId(null);
    
    if (!res.ok) {
      toast.error(res.error || 'Failed to unassign delivery.');
      return;
    }
    
    // Remove from my orders
    removeOrder(orderId);
    
    // Add back to unassigned if it's a delivery order
    if (res.order && isDeliveryOrder(res.order)) {
      setUnassignedDeliveries(prev => {
        const exists = prev.some(o => o._id === orderId);
        return exists ? prev : [res.order, ...prev];
      });
    }
    
    toast.success('Order unassigned and returned to pending deliveries.');
  };

  const handleFileChange = (orderId, file) => {
    if (!file) {
      setSelectedFiles(prev => {
        const updated = { ...prev };
        delete updated[orderId];
        return updated;
      });
      setPreviewImages(prev => {
        const updated = { ...prev };
        delete updated[orderId];
        return updated;
      });
      return;
    }

    setSelectedFiles(prev => ({
      ...prev,
      [orderId]: file
    }));

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImages(prev => ({
        ...prev,
        [orderId]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (orderId) => {
    const file = selectedFiles[orderId];
    if (!file) {
      toast.error('Please select an image first.');
      return;
    }
    setUploadingId(orderId);
    const res = await uploadDeliveryProof(orderId, file);
    setUploadingId(null);
    if (!res.ok) {
      toast.error(res.error || 'Failed to upload proof of delivery.');
      return;
    }
    if (res.order) upsertOrder(res.order);
    
    setSelectedFiles(prev => {
      const updated = { ...prev };
      delete updated[orderId];
      return updated;
    });
    setPreviewImages(prev => {
      const updated = { ...prev };
      delete updated[orderId];
      return updated;
    });
    
    toast.success('Delivery completed. Thank you!');
  };

  const handleRemoveImage = (orderId) => {
    setSelectedFiles(prev => {
      const updated = { ...prev };
      delete updated[orderId];
      return updated;
    });
    setPreviewImages(prev => {
      const updated = { ...prev };
      delete updated[orderId];
      return updated;
    });
  };

  const DeliveryCard = ({ order, children }) => {
    const displayId =
      order._id?.slice(-6).toUpperCase() || order.id || 'N/A';
    const addr =
      order.deliveryAddress ||
      [order.streetAddress, order.city, order.country]
        .filter(Boolean)
        .join(', ');

    return (
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Order #{displayId}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Placed {fmtTime(order.createdAt)}
            </div>
            {addr && (
              <div
                style={{
                  fontSize: 13,
                  color: '#111827',
                  marginTop: 6,
                  maxWidth: 420,
                }}
              >
                <span style={{ fontWeight: 600 }}>Address:</span> {addr}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: 13 }}>
            <div>Total</div>
            <div style={{ fontWeight: 700 }}>
              {currency(order.totalPrice || 0)}
            </div>
          </div>
        </div>
        {children}
      </Card>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <section className="max-w-3xl mx-auto mt-16 text-center">
        <p>Loading rider view…</p>
      </section>
    );
  }

  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl">
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        <div className="px-6 py-10 md:px-12 md:py-14">
          <div className="mb-8 text-center">
            <h2 className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Rider dashboard
            </h2>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              Deliveries assigned through the admin panel
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* left column: pending */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-zinc-900">
                Pending deliveries
              </h3>
              <p className="mb-4 text-sm text-zinc-600">
                These are delivery orders without a rider yet. Accept one to
                start the delivery.
              </p>

              <div className="space-y-3">
                {pendingDeliveries.length === 0 ? (
                  <Card>
                    <div
                      style={{
                        padding: 16,
                        textAlign: 'center',
                        color: '#64748b',
                      }}
                    >
                      No pending deliveries right now.
                    </div>
                  </Card>
                ) : (
                  pendingDeliveries.map((order) => (
                    <DeliveryCard key={order._id} order={order}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 8,
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                        }}
                      >
                        <Button
                          variant="outline"
                          small
                          disabled={actionId === order._id}
                          onClick={() => handleDecline(order._id)}
                        >
                          {actionId === order._id ? 'Processing…' : 'Decline'}
                        </Button>
                        <Button
                          small
                          disabled={actionId === order._id}
                          onClick={() => handleAccept(order._id)}
                        >
                          {actionId === order._id
                            ? 'Accepting…'
                            : 'Accept delivery'}
                        </Button>
                      </div>
                    </DeliveryCard>
                  ))
                )}
              </div>
            </div>

            {/* right column: active + completed */}
            <div className="space-y-8">
              <div>
                <h3 className="mb-3 text-lg font-semibold text-zinc-900">
                  On the way
                </h3>
                <p className="mb-4 text-sm text-zinc-600">
                  Upload a clear photo of the delivered order to complete it.
                  (Required)
                </p>

                <div className="space-y-3">
                  {myActiveDeliveries.length === 0 ? (
                    <Card>
                      <div
                        style={{
                          padding: 16,
                          textAlign: 'center',
                          color: '#64748b',
                        }}
                      >
                        You have no active deliveries.
                      </div>
                    </Card>
                  ) : (
                    myActiveDeliveries.map((order) => (
                      <DeliveryCard key={order._id} order={order}>
                        <div
                          style={{
                            marginTop: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }}
                        >
                          {/* Image Preview */}
                          {previewImages[order._id] && (
                            <div
                              style={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: 300,
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: '2px solid #e5e7eb',
                              }}
                            >
                              <img
                                src={previewImages[order._id]}
                                alt="Delivery proof preview"
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  display: 'block',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(order._id)}
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  background: 'rgba(0,0,0,0.7)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: 28,
                                  height: 28,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 18,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <label
                              htmlFor={`delivery-photo-${order._id}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px 14px',
                                borderRadius: 9999,
                                border: '1px solid #d4d4d8',
                                background: '#f9fafb',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {previewImages[order._id] ? 'Change photo…' : 'Choose photo…'}
                            </label>
                            <input
                              id={`delivery-photo-${order._id}`}
                              type="file"
                              accept="image/*"
                              style={{
                                position: 'absolute',
                                width: '1px',
                                height: '1px',
                                padding: 0,
                                margin: '-1px',
                                overflow: 'hidden',
                                clip: 'rect(0,0,0,0)',
                                whiteSpace: 'nowrap',
                                border: 0,
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileChange(order._id, file);
                                }
                              }}
                            />
                            
                            {previewImages[order._id] && (
                              <Button
                                small
                                disabled={uploadingId === order._id}
                                onClick={() => handleUpload(order._id)}
                              >
                                {uploadingId === order._id
                                  ? 'Uploading…'
                                  : 'Upload & Complete'}
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              small
                              disabled={actionId === order._id}
                              onClick={() => handleUnassign(order._id)}
                              style={{ marginLeft: 'auto' }}
                            >
                              {actionId === order._id ? 'Unassigning…' : 'Unassign from me'}
                            </Button>
                          </div>
                        </div>
                      </DeliveryCard>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold text-zinc-900">
                  Completed deliveries
                </h3>

                <div className="space-y-3 max-h-80 overflow-auto pr-2">
                  {myCompletedDeliveries.length === 0 ? (
                    <Card>
                      <div
                        style={{
                          padding: 16,
                          textAlign: 'center',
                          color: '#64748b',
                        }}
                      >
                        No completed deliveries yet.
                      </div>
                    </Card>
                  ) : (
                    myCompletedDeliveries.map((order) => {
                      const displayId =
                        order._id?.slice(-6).toUpperCase() ||
                        order.id ||
                        'N/A';

                      return (
                        <Card key={order._id}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                }}
                              >
                                Order #{displayId}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#64748b',
                                }}
                              >
                                Delivered{' '}
                                {order.deliveredAt
                                  ? fmtTime(order.deliveredAt)
                                  : fmtTime(order.updatedAt || order.createdAt)}
                              </div>
                            </div>
                            {order.deliveryProofUrl && (
                              <a
                                href={order.deliveryProofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs underline text-[#8B5E34]"
                              >
                                View proof
                              </a>
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   ADMIN VIEW (list riders in table, assign/unassign)
   ===================================================================== */

async function adminAssignToRider(orderId, rider) {
  const res = await fetch('/api/rider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'assign',
      orderId,
      riderId: rider._id,
      riderName: rider.name,
      riderEmail: rider.email,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data.error, order: data.order };
}

async function adminUnassign(orderId) {
  const res = await fetch('/api/rider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unassign', orderId }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data.error, order: data.order };
}

function AdminRiderDashboard() {
  const { status } = useSession();
  const [riders, setRiders] = useState([]);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRiderId, setSelectedRiderId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [imagePreviewModal, setImagePreviewModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  const selectedRider = useMemo(
    () => riders.find((r) => r._id === selectedRiderId) || null,
    [riders, selectedRiderId]
  );

  const fetchData = async () => {
    try {
      const res = await fetch('/api/rider', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load riders');
      const data = await res.json();
      setRiders(data.riders || []);
      setUnassignedOrders(data.unassignedOrders || []);
    } catch (err) {
      console.error('[AdminRiderDashboard] fetch error:', err);
      toast.error('Failed to load riders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  const activeRiders = useMemo(
    () => riders.filter((r) => r.active),
    [riders]
  );
  const inactiveRiders = useMemo(
    () => riders.filter((r) => !r.active),
    [riders]
  );

  const openRiderModal = (rider) => {
    setSelectedRiderId(rider._id);
    setSelectedOrderId('');
    setModalOpen(true);
  };

  const openImagePreview = (url) => {
    setPreviewImageUrl(url);
    setImagePreviewModal(true);
  };

  const handleAssign = async () => {
    if (!selectedRider || !selectedOrderId) {
      toast.error('Select an order to assign.');
      return;
    }
    setAssigning(true);
    const res = await adminAssignToRider(selectedOrderId, selectedRider);
    setAssigning(false);
    if (!res.ok) {
      toast.error(res.error || 'Failed to assign.');
      return;
    }

    setUnassignedOrders((prev) =>
      prev.filter((o) => o._id !== selectedOrderId)
    );

    setRiders((prev) =>
      prev.map((r) =>
        r._id === selectedRider._id
          ? {
              ...r,
              currentOrders: [
                ...(r.currentOrders || []),
                res.order || { _id: selectedOrderId },
              ],
            }
          : r
      )
    );

    toast.success('Order assigned to rider.');
    await fetchData();
  };

  const handleUnassign = async (orderId) => {
    setAssigning(true);
    const res = await adminUnassign(orderId);
    setAssigning(false);
    if (!res.ok) {
      toast.error(res.error || 'Failed to unassign.');
      return;
    }

    setRiders((prev) =>
      prev.map((r) => ({
        ...r,
        currentOrders: (r.currentOrders || []).filter((o) => o._id !== orderId),
      }))
    );

    if (res.order) {
      setUnassignedOrders((prev) => {
        const exists = prev.some((o) => o._id === res.order._id);
        return exists ? prev : [res.order, ...prev];
      });
    }

    toast.success('Order removed from rider.');
    await fetchData();
  };

  if (status === 'loading' || loading) {
    return (
      <section className="max-w-3xl mx-auto mt-16 text-center">
        <p>Loading riders…</p>
      </section>
    );
  }

  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl">
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        <div className="px-6 py-10 md:px-12 md:py-14">
          <div className="mb-8 text-center">
            <h2 className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Rider dashboard
            </h2>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              Manage active and inactive riders
            </p>
          </div>

          <div className="mb-8">
            <Card>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    Unassigned delivery orders
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    These can be assigned to riders from the modal.
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {unassignedOrders.length}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="mb-3 text-lg font-semibold text-zinc-900">
                Active riders
              </h3>
              <div className="overflow-hidden rounded-xl border border-white/40 bg-white/70 backdrop-blur-md">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-600">
                        Rider
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-600">
                        Email
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-zinc-600">
                        Active deliveries
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRiders.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-center text-zinc-500"
                        >
                          No active riders.
                        </td>
                      </tr>
                    )}
                    {activeRiders.map((rider) => (
                      <tr
                        key={rider._id}
                        className="cursor-pointer hover:bg-zinc-50"
                        onClick={() => openRiderModal(rider)}
                      >
                        <td className="px-3 py-2">{rider.name}</td>
                        <td className="px-3 py-2 text-zinc-600">
                          {rider.email}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {rider.currentOrders?.length || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-semibold text-zinc-900">
                Inactive riders
              </h3>
              <div className="overflow-hidden rounded-xl border border-white/40 bg-white/70 backdrop-blur-md">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-600">
                        Rider
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-600">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveRiders.length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-4 text-center text-zinc-500"
                        >
                          No inactive riders.
                        </td>
                      </tr>
                    )}
                    {inactiveRiders.map((rider) => (
                      <tr
                        key={rider._id}
                        className="cursor-pointer hover:bg-zinc-50"
                        onClick={() => openRiderModal(rider)}
                      >
                        <td className="px-3 py-2">{rider.name}</td>
                        <td className="px-3 py-2 text-zinc-600">
                          {rider.email}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <Modal
            open={modalOpen && !!selectedRider}
            onClose={() => {
              setModalOpen(false);
              setSelectedRiderId(null);
              setSelectedOrderId('');
            }}
            title={
              selectedRider
                ? `Rider: ${selectedRider.name || selectedRider.email}`
                : 'Rider details'
            }
          >
            {selectedRider && (
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-zinc-500 mb-1">Email</div>
                  <div className="font-medium">{selectedRider.email}</div>
                </div>

                <div>
                  <div className="text-sm text-zinc-500 mb-2">
                    Current deliveries
                  </div>
                  {selectedRider.currentOrders?.length ? (
                    <div className="space-y-3">
                      {selectedRider.currentOrders.map((o) => {
                        const displayId =
                          o._id?.slice(-6).toUpperCase() || 'N/A';
                        const addr =
                          o.deliveryAddress ||
                          [o.streetAddress, o.city, o.country]
                            .filter(Boolean)
                            .join(', ');
                        const isDelivered = ['delivered', 'completed'].includes(
                          (o.status || '').toLowerCase()
                        );

                        return (
                          <Card key={o._id}>
                            <div className="flex justify-between gap-3 mb-1">
                              <div>
                                <div className="font-semibold text-sm">
                                  Order #{displayId}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Placed {fmtTime(o.createdAt)}
                                </div>
                                {isDelivered && o.deliveredAt && (
                                  <div className="text-xs text-green-600 font-medium">
                                    ✓ Delivered {fmtTime(o.deliveredAt)}
                                  </div>
                                )}
                              </div>
                              <div className="text-right text-sm">
                                <div>Total</div>
                                <div className="font-semibold">
                                  {currency(o.totalPrice || 0)}
                                </div>
                              </div>
                            </div>
                            {addr && (
                              <div className="text-xs text-zinc-700 mb-2">
                                <span className="font-semibold">Address:</span>{' '}
                                {addr}
                              </div>
                            )}
                            
                            {o.deliveryProofUrl && (
                              <div
                                style={{
                                  marginTop: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#71717a',
                                    marginBottom: 6,
                                  }}
                                >
                                  Delivery proof:
                                </div>
                                <div
                                  onClick={() => openImagePreview(o.deliveryProofUrl)}
                                  style={{
                                    width: '100%',
                                    maxWidth: 200,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    border: '2px solid #e5e7eb',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <img
                                    src={o.deliveryProofUrl}
                                    alt="Delivery proof"
                                    style={{
                                      width: '100%',
                                      height: 'auto',
                                      display: 'block',
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            <Button
                              variant="outline"
                              small
                              disabled={assigning}
                              onClick={() => handleUnassign(o._id)}
                            >
                              {assigning ? 'Updating…' : 'Remove from rider'}
                            </Button>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500">
                      No active deliveries for this rider.
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm text-zinc-500 mb-2">
                    Assign an unassigned delivery
                  </div>
                  {unassignedOrders.length === 0 ? (
                    <div className="text-sm text-zinc-500">
                      No unassigned delivery orders.
                    </div>
                  ) : (
                    <div className="flex gap-3 items-center flex-wrap">
                      <select
                        className="border rounded-lg px-3 py-2 text-sm"
                        value={selectedOrderId}
                        onChange={(e) => setSelectedOrderId(e.target.value)}
                      >
                        <option value="">Select order…</option>
                        {unassignedOrders.map((o) => {
                          const displayId =
                            o._id?.slice(-6).toUpperCase() || 'N/A';
                          return (
                            <option key={o._id} value={o._id}>
                              #{displayId} — {currency(o.totalPrice || 0)}
                            </option>
                          );
                        })}
                      </select>
                      <Button
                        small
                        disabled={assigning || !selectedOrderId}
                        onClick={handleAssign}
                      >
                        {assigning ? 'Assigning…' : 'Assign to rider'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Modal>

          <Modal
            open={imagePreviewModal}
            onClose={() => {
              setImagePreviewModal(false);
              setPreviewImageUrl('');
            }}
            title="Delivery Proof"
          >
            <div style={{ textAlign: 'center' }}>
              <img
                src={previewImageUrl}
                alt="Delivery proof full size"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 8,
                }}
              />
            </div>
          </Modal>
        </div>
      </div>
    </section>
  );
}

export default function RiderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = session?.user?.role;
  const isAdmin = role === 'admin' || session?.user?.admin === true;
  const isRider = role === 'rider' || session?.user?.rider === true;

  if (status === 'loading') {
    return (
      <section className="max-w-3xl mx-auto mt-16 text-center">
        <p>Loading…</p>
      </section>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <section className="max-w-3xl mx-auto mt-16 text-center">
        <h2 className="text-xl font-semibold mb-4">
          Please log in to access rider tools
        </h2>
        <Button onClick={() => router.push('/login')}>Go to Login</Button>
      </section>
    );
  }

  if (isAdmin) {
    return <AdminRiderDashboard />;
  }

  if (isRider) {
    return <RiderSelfDashboard />;
  }

  return (
    <section className="max-w-3xl mx-auto mt-16 text-center">
      <h2 className="text-xl font-semibold mb-2">Access denied</h2>
      <p className="text-sm text-zinc-600">
        Only riders and admins can view the rider page.
      </p>
    </section>
  );
}