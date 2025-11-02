'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import * as XLSX from 'xlsx';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

/** format a Date to YYYY-MM-DD in LOCAL time (for <input type="date">) */
function formatDateInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function peso(n = 0) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n || 0));
}

function calcOrderTotal(order) {
  if (typeof order?.totalPrice === 'number') return order.totalPrice;

  if (Array.isArray(order?.cartProducts)) {
    const itemsTotal = order.cartProducts.reduce((sum, item) => {
      let price = Number(item?.basePrice || 0);
      if (item?.size?.price) price += Number(item.size.price);
      if (Array.isArray(item?.extras)) {
        for (const ex of item.extras) price += Number(ex?.price || 0);
      }
      return sum + price;
    }, 0);
    return itemsTotal;
  }

  if (Array.isArray(order?.items)) {
    return order.items.reduce((s, it) => s + Number(it?.qty || 0) * Number(it?.price || 0), 0);
  }
  return 0;
}

export default function AccountingDashboardPage() {
  const { data: session, status } = useSession();

  const isAdmin = session?.user?.admin === true || session?.user?.role === 'admin';
  const isAccounting = session?.user?.accounting === true || session?.user?.role === 'accounting';
  const canView = isAdmin || isAccounting;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState('');
  const [filterType, setFilterType] = useState('monthly'); // 'weekly', 'monthly', 'custom'

  // Default to start-of-month → end-of-month (local)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [from, setFrom] = useState(formatDateInput(monthStart));
  const [to, setTo] = useState(formatDateInput(monthEnd));

  // Dropdown/accordion state for the table
  const [showTable, setShowTable] = useState(false);
  
  // Customer orders modal
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchOrders();
  }, [status]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders', { cache: 'no-store' });
      const data = await res.json();
      // Filter out archived orders
      const activeOrders = Array.isArray(data) ? data.filter(o => !o.archived) : [];
      setOrders(activeOrders);
    } catch (e) {
      console.error('Failed loading orders', e);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Handle filter type changes
  const handleFilterChange = (type) => {
    setFilterType(type);
    const now = new Date();
    
    switch (type) {
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Sunday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Saturday
        
        setFrom(formatDateInput(weekStart));
        setTo(formatDateInput(weekEnd));
        break;
        
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        setFrom(formatDateInput(monthStart));
        setTo(formatDateInput(monthEnd));
        break;
        
      case 'custom':
        // Keep current dates
        break;
    }
  };

  const fromDate = useMemo(() => new Date(from + 'T00:00:00'), [from]);
  const toDate = useMemo(() => new Date(to + 'T23:59:59.999'), [to]);

  // Filter by date + search
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter((o) => {
      const created = new Date(o.createdAt);
      if (created < fromDate || created > toDate) return false;

      if (!s) return true;
      const id = (o._id || '').toString().slice(-6).toUpperCase();
      const email = (o.userEmail || '').toLowerCase();
      const statusStr = (o.status || '').toLowerCase();
      const paidStr = o.paid ? 'paid' : 'unpaid';

      const itemHit = Array.isArray(o.cartProducts)
        ? o.cartProducts.some((it) => (it?.name || '').toLowerCase().includes(s))
        : false;

      return (
        id.includes(s) ||
        email.includes(s) ||
        statusStr.includes(s) ||
        paidStr.includes(s) ||
        itemHit
      );
    });
  }, [orders, q, fromDate, toDate]);

  // Aggregates
  const { sales, received, unpaidCount, txCount } = useMemo(() => {
    let _sales = 0;
    let _received = 0;
    let _tx = 0;
    let _unpaid = 0;

    for (const o of filtered) {
      const total = calcOrderTotal(o);
      _sales += total;
      _tx += 1;
      if (o.paid) _received += total;
      else _unpaid += 1;
    }
    return { sales: _sales, received: _received, unpaidCount: _unpaid, txCount: _tx };
  }, [filtered]);

  const balance = received;

  // Calculate best sellers
  const bestSellers = useMemo(() => {
    const productSales = {};
    
    filtered.forEach(order => {
      order.cartProducts?.forEach(item => {
        const name = item.name || 'Unknown';
        if (!productSales[name]) {
          productSales[name] = { quantitySold: 0, revenue: 0 };
        }
        productSales[name].quantitySold += 1;
        
        let itemRevenue = Number(item.basePrice || 0);
        if (item.size?.price) itemRevenue += Number(item.size.price);
        if (item.extras?.length > 0) {
          item.extras.forEach(ex => itemRevenue += Number(ex.price || 0));
        }
        
        productSales[name].revenue += itemRevenue;
      });
    });

    return Object.entries(productSales)
      .map(([productName, data]) => ({ productName, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Stock depletion for pie chart (top 6 products)
  const stockDepletion = useMemo(() => bestSellers.slice(0, 6), [bestSellers]);

  // Pie chart data
  const pieChartData = {
    labels: stockDepletion.map(item => item.productName),
    datasets: [{
      data: stockDepletion.map(item => item.quantitySold),
      backgroundColor: [
        '#A5724A',
        '#7A4E2A',
        '#D8C3A5',
        '#E2B992',
        '#B08B62',
        '#F3EDE2',
      ],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} units (${percentage}%)`;
          }
        }
      }
    }
  };

  // View customer orders
  const viewCustomerOrders = (customerEmail) => {
    const customerOrders = orders
      .filter(order => order.userEmail === customerEmail)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    setSelectedCustomer({
      email: customerEmail,
      orders: customerOrders
    });
  };

  // Archive transaction
  const archiveTransaction = async (orderId) => {
    if (!confirm('Archive this transaction? It will be hidden from the dashboard.')) return;
    
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          _id: orderId,
          archived: true,
          archivedAt: new Date(),
          archivedBy: session?.user?.email
        }),
      });
      
      if (!res.ok) throw new Error('Failed to archive');
      
      toast.success('Transaction archived successfully');
      fetchOrders(); // Refresh data
    } catch (error) {
      console.error('Error archiving:', error);
      toast.error('Failed to archive transaction');
    }
  };

  const printPage = () => window.print();

  // Enhanced Excel export with summary
  const exportExcel = () => {
    try {
      // Prepare data with all required columns
      const excelData = filtered.map(order => {
        // Get items purchased
        const items = order.cartProducts?.map(item => {
          let itemStr = item.name;
          if (item.size?.name) itemStr += ` (${item.size.name})`;
          if (item.extras?.length > 0) {
            itemStr += ` + ${item.extras.map(e => e.name).join(', ')}`;
          }
          return itemStr;
        }).join('; ') || 'N/A';

        const orderDate = new Date(order.createdAt);

        return {
          'Order ID': `#${order._id?.slice(-6).toUpperCase()}`,
          'Customer Name': order.userName || 'N/A',
          'Customer Email': order.userEmail,
          'Activities (Items Purchased)': items,
          'Date': orderDate.toLocaleDateString('en-PH'),
          'Time': orderDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }),
          'Amount': order.totalPrice || calcOrderTotal(order),
          'Status': order.paid ? 'Paid' : 'Unpaid',
        };
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 12 }, // Order ID
        { wch: 20 }, // Customer Name
        { wch: 30 }, // Customer Email
        { wch: 50 }, // Activities
        { wch: 12 }, // Date
        { wch: 10 }, // Time
        { wch: 12 }, // Amount
        { wch: 10 }, // Status
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Accounting Report');

      // Generate filename
      const filename = `accounting-report-${from}-to-${to}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, filename);
      
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };

  if (status === 'loading') {
    return <div className="p-6">Loading…</div>;
  }

  if (!canView) {
    return (
      <section className="max-w-7xl mx-auto py-12">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-slate-600 mt-2">
            Only <span className="font-semibold">Admin</span> and{' '}
            <span className="font-semibold">Accounting</span> can view this page.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative">
      {/* soft brown blurred wallpaper */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#F3EDE2] to-[#D8C3A5] opacity-50 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-[#F2D6C1] to-[#E2B992] opacity-30 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-[#E2D2BE] to-[#B08B62] opacity-30 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto py-6 px-6 md:px-12">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Accounting Dashboard</h1>
          <div className="no-print flex gap-2">
            <button
              onClick={exportExcel}
              className="border rounded-lg px-3 py-2 hover:bg-slate-50 cursor-pointer transition"
            >
              Export Excel
            </button>
            <button
              style={{ color: 'white' }}
              onClick={printPage}
              className="bg-black text-white rounded-lg px-3 py-2 cursor-pointer hover:bg-zinc-800 transition"
            >
              Print
            </button>
          </div>
        </div>

        {/* Filter Type Buttons + Date Filters + Search */}
        <div className="no-print mb-4 space-y-3">
          {/* Filter Type Buttons */}
          <div className="flex gap-2">
            <span
              onClick={() => handleFilterChange('weekly')}
              className={`w-full cursor-pointer px-4 py-2 rounded-lg font-medium transition ${
                filterType === 'weekly'
                  ? 'bg-[#A5724A] text-white'
                  : 'border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Weekly
            </span>
            <span
              onClick={() => handleFilterChange('monthly')}
              className={`w-full cursor-pointer px-4 py-2 rounded-lg font-medium transition ${
                filterType === 'monthly'
                  ? 'bg-[#A5724A] text-white'
                  : 'border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Monthly
            </span>
            <span
              onClick={() => handleFilterChange('custom')}
              className={`w-full cursor-pointer px-4 py-2 rounded-lg font-medium transition ${
                filterType === 'custom'
                  ? 'bg-[#A5724A] text-white'
                  : 'border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Custom
            </span>
          </div>

          {/* Date inputs and search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 w-16">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setFilterType('custom');
                }}
                className="border rounded-lg px-3 py-2 w-full cursor-pointer focus:ring-2 focus:ring-[#A5724A] focus:border-[#A5724A]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 w-16">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setFilterType('custom');
                }}
                className="border rounded-lg px-3 py-2 w-full cursor-pointer focus:ring-2 focus:ring-[#A5724A] focus:border-[#A5724A]"
              />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (order id, email, item, paid/unpaid, status)…"
              className="border rounded-lg px-3 py-2 w-full outline-none focus:ring-2 focus:ring-[#A5724A] focus:border-[#A5724A]"
            />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card title="Sales" value={peso(sales)} subtitle="Total Sale" />
          <Card title="Received Money" value={peso(received)} subtitle="Received Money" />
          <Card title="Balance" value={peso(balance)} subtitle="Total in Account" />
          <Card title="Transactions" value={txCount} subtitle={`${unpaidCount} unpaid`} />
        </div>

        {/* Best Sellers & Stock Depletion */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Best Sellers */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900 mb-4">🏆 Best Sellers</h2>
            <div className="space-y-3">
              {bestSellers.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📦'}
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900">{item.productName}</div>
                      <div className="text-sm text-zinc-600">{item.quantitySold} units sold</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#A5724A]">{peso(item.revenue)}</div>
                    <div className="text-xs text-zinc-500">Revenue</div>
                  </div>
                </div>
              ))}
              {bestSellers.length === 0 && (
                <div className="text-center py-8 text-slate-400">No sales data available</div>
              )}
            </div>
          </div>

          {/* Stock Depletion Pie Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900 mb-4">📊 Stock Depletion by Product</h2>
            {stockDepletion.length > 0 ? (
              <div className="h-[300px]">
                <Pie data={pieChartData} options={pieChartOptions} />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Dropdown / Accordion toggle */}
        <div className="no-print mb-3">
          <button
            onClick={() => setShowTable((v) => !v)}
            className="w-full sm:w-auto inline-flex items-center justify-between gap-2 border rounded-lg px-4 py-2 hover:bg-slate-50 transition"
            aria-expanded={showTable}
            aria-controls="transactions-panel"
          >
            {showTable ? 'Hide transactions' : 'Show transactions'}
            <span aria-hidden>{showTable ? '▲' : '▼'}</span>
          </button>
        </div>

        {/* History / Transactions table */}
        {showTable && (
          <div
            id="transactions-panel"
            className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr className="[&>th]:py-3 [&>th]:px-3 border-b border-slate-200">
                    <th className="text-left w-32">Date</th>
                    <th className="text-left w-20">Time</th>
                    <th className="text-left w-28">Order</th>
                    <th className="text-left">Customer</th>
                    <th className="text-left w-28">Status</th>
                    <th className="text-left w-24">Paid</th>
                    <th className="text-right w-32">Amount</th>
                    <th className="text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No transactions for this filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((o) => {
                      const d = new Date(o.createdAt);
                      const date = d.toLocaleDateString('en-PH');
                      const time = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
                      const id = (o._id || '').toString().slice(-6).toUpperCase();
                      const amt = calcOrderTotal(o);
                      return (
                        <tr key={o._id} className="hover:bg-slate-50">
                          <td className="py-2 px-3">{date}</td>
                          <td className="py-2 px-3">{time}</td>
                          <td className="py-2 px-3 font-mono">#{id}</td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => viewCustomerOrders(o.userEmail)}
                              className="text-[#A5724A] hover:underline font-medium"
                            >
                              {o.userEmail || '—'}
                            </button>
                          </td>
                          <td className="py-2 px-3 capitalize">{o.status || '—'}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              o.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {o.paid ? 'PAID' : 'UNPAID'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold">{peso(amt)}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => archiveTransaction(o._id)}
                              className="px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition"
                            >
                              Archive
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customer Orders Modal */}
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-zinc-900">Customer Order History</h2>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-zinc-400 hover:text-zinc-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                <div className="text-sm text-zinc-600">Customer Email</div>
                <div className="text-lg font-semibold text-zinc-900">{selectedCustomer.email}</div>
                <div className="mt-2 text-sm text-zinc-600">
                  Total Orders: <span className="font-semibold">{selectedCustomer.orders?.length || 0}</span>
                </div>
                <div className="text-sm text-zinc-600">
                  Total Spent: <span className="font-semibold">{peso(selectedCustomer.orders?.reduce((sum, o) => sum + calcOrderTotal(o), 0))}</span>
                </div>
              </div>

              <div className="space-y-4">
                {selectedCustomer.orders?.map((order) => {
                  const orderDate = new Date(order.createdAt);
                  return (
                    <div key={order._id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold text-zinc-900">
                            Order #{order._id?.slice(-6).toUpperCase()}
                          </div>
                          <div className="text-sm text-zinc-600">
                            {orderDate.toLocaleDateString('en-PH')} at {orderDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-[#A5724A]">{peso(calcOrderTotal(order))}</div>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            order.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {order.paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-zinc-700">Items:</div>
                        {order.cartProducts?.map((item, idx) => (
                          <div key={idx} className="text-sm text-zinc-600 pl-4">
                            • {item.name}
                            {item.size?.name && ` (${item.size.name})`}
                            {item.extras?.length > 0 && ` + ${item.extras.map(e => e.name).join(', ')}`}
                            {' - '}{peso(item.basePrice + (item.size?.price || 0) + (item.extras?.reduce((s, e) => s + (e.price || 0), 0) || 0))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Print styles */}
        <style jsx global>{`
          @media print {
            .no-print { display: none !important; }
            body { background: #fff !important; }
            table { font-size: 12px; }
          }
        `}</style>
      </div>
    </section>
  );
}

function Card({ title, value, subtitle }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-600">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}