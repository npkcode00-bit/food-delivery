'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

export default function AdminOrderNotifications() {
  const { data: session, status } = useSession();
  const previousOrderCountRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const hasShownLoginNotificationRef = useRef(false);

  // Get admin status directly from session
  const isAdmin = session?.user?.admin || false;

  // Poll for new orders (only for admins)
  useEffect(() => {
    if (!isAdmin || status !== 'authenticated') return;

    const checkForNewOrders = async () => {
      try {
        const res = await fetch('/api/orders');
        
        // Check if response is OK
        if (!res.ok) {
          console.error('Failed to fetch orders:', res.status);
          return;
        }

        // Check if response is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Expected JSON but got:', contentType);
          return;
        }

        const data = await res.json();
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
          console.error('Expected array but got:', typeof data);
          return;
        }

        // Initialize on first load - show all "placed" orders
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
          previousOrderCountRef.current = data.length;
          
          // Get all orders with status "placed"
          const placedOrders = data.filter(order => order.status === 'placed');
          
          if (placedOrders.length > 0 && !hasShownLoginNotificationRef.current) {
            hasShownLoginNotificationRef.current = true;
            
            // Show notification for each placed order (up to 10)
            const ordersToShow = placedOrders.slice(0, 10);
            
            ordersToShow.forEach((order, index) => {
              // Calculate total price
              let totalPrice = order.totalPrice || 0;
              if (!totalPrice && order.cartProducts) {
                totalPrice = order.cartProducts.reduce((sum, item) => {
                  let price = item.basePrice || 0;
                  if (item.size?.price) price += item.size.price;
                  if (item.extras) {
                    item.extras.forEach(extra => price += extra.price || 0);
                  }
                  return sum + price;
                }, 0);
              }
              
              // Delay each toast slightly so they don't all appear at once
              setTimeout(() => {
                toast.custom((t) => (
                  <div style={{
                    background: '#fff',
                    borderRadius: 12,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    padding: 20,
                    border: '2px solid #f59e0b',
                    minWidth: 320,
                    maxWidth: 400,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                      <div style={{ fontSize: 28 }}>⏳</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: 700, 
                          fontSize: 18, 
                          marginBottom: 8,
                          color: '#111',
                        }}>
                          Pending Order
                          {placedOrders.length > 1 && (
                            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400, marginLeft: 4 }}>
                              ({index + 1} of {ordersToShow.length})
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: 15, 
                          marginBottom: 6,
                          fontWeight: 600,
                          color: '#f59e0b',
                        }}>
                          Order #{order._id?.slice(-6).toUpperCase()}
                        </div>
                        <div style={{ 
                          fontSize: 14, 
                          color: '#64748b', 
                          marginBottom: 4 
                        }}>
                          {order.cartProducts?.length || 0} item(s)
                        </div>
                        <div style={{ 
                          fontSize: 16, 
                          color: '#111',
                          fontWeight: 600,
                          marginBottom: 6,
                        }}>
                          Total: ${totalPrice.toFixed(2)}
                        </div>
                        <div style={{ 
                          fontSize: 13, 
                          color: '#64748b', 
                          marginBottom: 12,
                          wordBreak: 'break-word',
                        }}>
                          Customer: {order.userEmail}
                        </div>
                        
                        {/* Order items preview */}
                        {order.cartProducts?.slice(0, 2).map((item, idx) => (
                          <div key={idx} style={{ 
                            fontSize: 12, 
                            color: '#475569',
                            marginBottom: 2,
                          }}>
                            • {item.name}
                          </div>
                        ))}
                        {order.cartProducts?.length > 2 && (
                          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                            +{order.cartProducts.length - 2} more items
                          </div>
                        )}
                        
                        <div style={{ 
                          display: 'flex', 
                          gap: 8, 
                          marginTop: 12 
                        }}>
                          <button
                            onClick={() => {
                              toast.dismiss(t.id);
                              window.location.href = '/orders';
                            }}
                            style={{
                              flex: 1,
                              padding: '10px 16px',
                              borderRadius: 8,
                              background: '#f59e0b',
                              color: '#fff',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 14,
                            }}
                          >
                            View Orders
                          </button>
                          <button
                            onClick={() => toast.dismiss(t.id)}
                            style={{
                              padding: '10px 16px',
                              borderRadius: 8,
                              background: '#f1f5f9',
                              color: '#64748b',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 14,
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ), {
                  duration: Infinity,
                  position: 'top-right',
                });
              }, index * 300); // 300ms delay between each notification
            });

            // If there are more than 10 placed orders, show a summary
            if (placedOrders.length > 10) {
              setTimeout(() => {
                toast.success(
                  `${placedOrders.length - 10} more pending orders! Check the orders page.`,
                  {
                    duration: 5000,
                    position: 'top-right',
                  }
                );
              }, ordersToShow.length * 300);
            }
          }
          
          return; // Skip the new order check on first load
        }
        
        // Check for new orders (after initialization)
        if (data.length > previousOrderCountRef.current) {
          const latestOrder = data[0]; // Most recent order
          
          // Calculate total price
          let totalPrice = latestOrder.totalPrice || 0;
          if (!totalPrice && latestOrder.cartProducts) {
            totalPrice = latestOrder.cartProducts.reduce((sum, item) => {
              let price = item.basePrice || 0;
              if (item.size?.price) price += item.size.price;
              if (item.extras) {
                item.extras.forEach(extra => price += extra.price || 0);
              }
              return sum + price;
            }, 0);
          }
          
          // Show persistent toast for new order
          toast.custom((t) => (
            <div style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              padding: 20,
              border: '2px solid #10b981',
              minWidth: 320,
              maxWidth: 400,
            }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                <div style={{ fontSize: 28 }}>🍕</div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: 18, 
                    marginBottom: 8,
                    color: '#111',
                  }}>
                    🔔 New Order Received!
                  </div>
                  <div style={{ 
                    fontSize: 15, 
                    marginBottom: 6,
                    fontWeight: 600,
                    color: '#10b981',
                  }}>
                    Order #{latestOrder._id?.slice(-6).toUpperCase()}
                  </div>
                  <div style={{ 
                    fontSize: 14, 
                    color: '#64748b', 
                    marginBottom: 4 
                  }}>
                    {latestOrder.cartProducts?.length || 0} item(s)
                  </div>
                  <div style={{ 
                    fontSize: 16, 
                    color: '#111',
                    fontWeight: 600,
                    marginBottom: 6,
                  }}>
                    Total: ${totalPrice.toFixed(2)}
                  </div>
                  <div style={{ 
                    fontSize: 13, 
                    color: '#64748b', 
                    marginBottom: 12,
                    wordBreak: 'break-word',
                  }}>
                    Customer: {latestOrder.userEmail}
                  </div>
                  
                  {/* Order items preview */}
                  {latestOrder.cartProducts?.slice(0, 2).map((item, idx) => (
                    <div key={idx} style={{ 
                      fontSize: 12, 
                      color: '#475569',
                      marginBottom: 2,
                    }}>
                      • {item.name}
                    </div>
                  ))}
                  {latestOrder.cartProducts?.length > 2 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                      +{latestOrder.cartProducts.length - 2} more items
                    </div>
                  )}
                  
                  <div style={{ 
                    display: 'flex', 
                    gap: 8, 
                    marginTop: 12 
                  }}>
                    <button
                      onClick={() => {
                        toast.dismiss(t.id);
                        window.location.href = '/orders';
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: 8,
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      View Orders
                    </button>
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 8,
                        background: '#f1f5f9',
                        color: '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ), {
            duration: Infinity,
            position: 'top-right',
          });

          // Play notification sound
          try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
          } catch (e) {
            console.log('Audio not available');
          }
        }
        
        previousOrderCountRef.current = data.length;
        
      } catch (err) {
        console.error('Error checking for new orders:', err);
      }
    };

    // Check immediately
    checkForNewOrders();
    
    // Then check every 5 seconds
    const interval = setInterval(checkForNewOrders, 5000);
    
    return () => clearInterval(interval);
  }, [isAdmin, status]);

  // This component doesn't render anything visible
  return null;
}