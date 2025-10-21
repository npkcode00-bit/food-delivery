'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

function peso(n = 0) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n || 0));
}

function calcOrderTotal(order) {
  if (typeof order?.totalPrice === 'number') return order.totalPrice;

  // derive from cartProducts (basePrice + size.price + extras[].price)
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

  // legacy fallback
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
  const today = new Date();
  const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const [from, setFrom] = useState(sevenDaysAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        setLoading(true);
        // server should return ALL orders for admin/accounting (see API tweak below)
        const res = await fetch('/api/orders', { cache: 'no-store' });
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed loading orders', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const fromDate = useMemo(() => new Date(from + 'T00:00:00'), [from]);
  const toDate = useMemo(() => new Date(to + 'T23:59:59'), [to]);

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

  const balance = received; // adjust here if you later subtract payouts/expenses

  const printPage = () => window.print();

  const exportCSV = () => {
    const headers = [
      'Date',
      'Time',
      'OrderID',
      'Customer',
      'Status',
      'Paid',
      'Amount',
    ];
    const rows = filtered.map((o) => {
      const d = new Date(o.createdAt);
      const date = d.toLocaleDateString('en-PH');
      const time = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      const id = (o._id || '').toString().slice(-6).toUpperCase();
      return [
        date,
        time,
        `#${id}`,
        o.userEmail || '',
        o.status || '',
        o.paid ? 'PAID' : 'UNPAID',
        calcOrderTotal(o),
      ];
    });

    const csv =
      headers.join(',') +
      '\n' +
      rows
        .map((r) =>
          r
            .map((v) => {
              const s = String(v ?? '');
              if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
              }
              return s;
            })
            .join(',')
        )
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    <section className="max-w-7xl mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Accounting Dashboard</h1>
        <div className="no-print flex gap-2">
          <button
            onClick={exportCSV}
            className="border rounded-lg px-3 py-2 hover:bg-slate-50 cursor-pointer"
          >
            Export CSV
          </button>
          <button
            onClick={printPage}
            className="bg-black text-white rounded-lg px-3 py-2 cursor-pointer"
          >
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 w-16">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 w-16">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full cursor-pointer"
          />
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search (order id, email, item, paid/unpaid, status)…"
          className="border rounded-lg px-3 py-2 w-full outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card title="Sales " value={peso(sales)} subtitle="Total Sale" />
        <Card title="Received Money" value={peso(received)} subtitle="Received Money" />
        <Card title="Balance" value={peso(balance)} subtitle="Total in Account" />
        <Card title="Transactions" value={txCount} subtitle={`${unpaidCount} unpaid`} />
      </div>

      {/* History / Transactions table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
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
                    <tr key={o._id}>
                      <td className="py-2 px-3">{date}</td>
                      <td className="py-2 px-3">{time}</td>
                      <td className="py-2 px-3 font-mono">#{id}</td>
                      <td className="py-2 px-3">{o.userEmail || '—'}</td>
                      <td className="py-2 px-3 capitalize">{o.status || '—'}</td>
                      <td className="py-2 px-3">{o.paid ? 'PAID' : 'UNPAID'}</td>
                      <td className="py-2 px-3 text-right font-semibold">{peso(amt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          table { font-size: 12px; }
        }
      `}</style>
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
