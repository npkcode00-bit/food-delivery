'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function OrdersIndexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch orders function
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders on mount and set up polling
  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrders();
      
      // Poll every 3 seconds for updates
      const interval = setInterval(fetchOrders, 3000);
      
      return () => clearInterval(interval);
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  // Enhanced filter orders in real-time
  const filteredOrders = orders.filter(order => {
    if (!search) return true;
    
    const searchLower = search.toLowerCase().trim();
    
    // Search by Order ID
    const orderId = order._id?.slice(-6).toUpperCase() || '';
    if (orderId.includes(searchLower.toUpperCase())) return true;
    
    // Search by Phone
    if (order.phone?.includes(search)) return true;
    
    // Search by Email
    if (order.userEmail?.toLowerCase().includes(searchLower)) return true;
    
    // Search by Date (various formats)
    const orderDate = new Date(order.createdAt);
    const dateString = orderDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).toLowerCase();
    const shortDate = orderDate.toLocaleDateString('en-US').toLowerCase();
    if (dateString.includes(searchLower) || shortDate.includes(searchLower)) return true;
    
    // Search by Status
    const statusMap = {
      'placed': ['placed', 'new', 'pending'],
      'in_kitchen': ['kitchen', 'cooking', 'preparing'],
      'on_the_way': ['way', 'delivery', 'delivering', 'transit'],
      'delivered': ['delivered', 'complete', 'completed'],
      'cancelled': ['cancelled', 'canceled', 'cancel'],
    };
    
    for (const [status, keywords] of Object.entries(statusMap)) {
      if (order.status === status && keywords.some(keyword => keyword.includes(searchLower))) {
        return true;
      }
    }
    
    // Search by Items/Products
    if (order.cartProducts && Array.isArray(order.cartProducts)) {
      const hasMatchingItem = order.cartProducts.some(item => {
        // Search item name
        if (item.name?.toLowerCase().includes(searchLower)) return true;
        
        // Search size name
        if (item.size?.name?.toLowerCase().includes(searchLower)) return true;
        
        // Search extras
        if (item.extras && Array.isArray(item.extras)) {
          return item.extras.some(extra => 
            extra.name?.toLowerCase().includes(searchLower)
          );
        }
        
        return false;
      });
      
      if (hasMatchingItem) return true;
    }
    
    return false;
  });

  // Calculate total price from cart products
  const calculateOrderTotal = (order) => {
    if (order.totalPrice) return order.totalPrice;
    
    if (!order.cartProducts || order.cartProducts.length === 0) return 0;
    
    let total = 0;
    order.cartProducts.forEach(product => {
      let price = product.basePrice || 0;
      
      if (product.size?.price) {
        price += product.size.price;
      }
      
      if (product.extras && Array.isArray(product.extras)) {
        product.extras.forEach(extra => {
          price += extra.price || 0;
        });
      }
      
      total += price;
    });
    
    return total;
  };

  if (status === 'loading' || loading) {
    return (
      <section className="max-w-4xl mx-auto mt-10 px-4">
        <div className="text-center py-8">Loading...</div>
      </section>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <section className="max-w-xl mx-auto mt-10 px-4">
        <div className="rounded-xl border border-slate-200 p-6 bg-slate-50">
          <h3 className="font-semibold text-lg">Login required</h3>
          <p className="text-slate-600 mt-1">Sign in to view your orders.</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-4 py-2 bg-black text-white rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto mt-10 px-4">
      <h1 className="text-3xl font-bold">My Orders</h1>
      
      

      {/* Results count */}
      {search && (
        <div className="mt-4 text-sm text-slate-600">
          Found {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} matching &quot;{search}&quot;
        </div>
      )}

      {/* Orders list */}
      <div className="mt-8">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl">
            {search ? (
              <>
                <p className="text-slate-600 mb-2">No orders found matching &quot;{search}&quot;</p>
                <p className="text-sm text-slate-500">
                  Try searching by order ID, item name, status, or date
                </p>
                <button
                  onClick={() => setSearch('')}
                  className="mt-4 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-600">No orders yet</p>
                <button
                  onClick={() => router.push('/menu')}
                  className="mt-4 px-4 py-2 bg-black text-white rounded-lg"
                >
                  Start Shopping
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const total = calculateOrderTotal(order);
              
              return (
                <div
                  key={order._id}
                  className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/orders/${order._id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Order #{order._id?.slice(-6).toUpperCase() || 'N/A'}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          order.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'on_the_way'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'in_kitchen'
                            ? 'bg-orange-100 text-orange-800'
                            : order.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {order.status === 'placed' && (order.paid ? 'Placed' : 'Pending Payment')}
                        {order.status === 'in_kitchen' && 'In the kitchen'}
                        {order.status === 'on_the_way' && 'On the way'}
                        {order.status === 'delivered' && 'Delivered'}
                        {order.status === 'cancelled' && 'Cancelled'}
                      </span>
                      <p className="text-lg font-bold mt-2">
                        ${total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Order items preview */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-600">
                      {order.cartProducts?.length || 0} item(s)
                    </p>
                    {order.cartProducts?.slice(0, 2).map((item, idx) => (
                      <p key={idx} className="text-sm text-slate-700 mt-1">
                        • {item.name || 'Product'}
                        {item.size?.name && ` (${item.size.name})`}
                      </p>
                    ))}
                    {order.cartProducts?.length > 2 && (
                      <p className="text-sm text-slate-500 mt-1">
                        +{order.cartProducts.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}