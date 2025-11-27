'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: 'all',        label: 'All roles' },
  { value: 'customer',   label: 'Customer' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'cashier',    label: 'Cashier' },
  { value: 'rider',      label: 'Rider' },       // ✅ NEW
  { value: 'admin',      label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const parseMaybeJson = async (res) => {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await res.json();
  const text = await res.text();
  return { message: text || `${res.status} ${res.statusText}` };
};

export default function AdminUsersClient() {
  const { data: session } = useSession();
  const currentUserRole = session?.user?.role;
  const isSuperAdmin = currentUserRole === 'superadmin';

  const [viewMode, setViewMode] = useState('active'); // 'active' or 'archived'
  const [roleFilter, setRoleFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [archivingUser, setArchivingUser] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const [restoringUser, setRestoringUser] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const totalPages = Math.ceil(totalUsers / pageSize);

  async function loadUsers(role = roleFilter, page = currentPage, size = pageSize, mode = viewMode) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (role && role !== 'all') params.append('role', role);
      params.append('page', page.toString());
      params.append('limit', size.toString());
      params.append('archived', mode === 'archived' ? 'true' : 'false');

      const res = await fetch(`/api/users?${params.toString()}`, { cache: 'no-store' });
      const data = await parseMaybeJson(res);
      if (!res.ok) throw new Error(data?.message || 'Failed fetching users');
      
      setUsers(data.users || []);
      setTotalUsers(data.total || 0);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers('all', 1, pageSize, viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    loadUsers(roleFilter, 1, pageSize, viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, pageSize, viewMode]);

  useEffect(() => {
    loadUsers(roleFilter, currentPage, pageSize, viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const onEditClick = (user) => {
    setEditing({
      ...user,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      address: user.address || '',
      phone: user.phone || '',
      email: user.email || '',
      role: user.role || (user.admin ? 'admin' : 'customer'),
      isOwnAccount: session?.user?.email === user.email,
    });
  };
  const onCloseEdit = () => setEditing(null);

  const onSave = async () => {
    if (!editing?._id) return;
    setSaving(true);
    try {
      const payload = {
        id: editing._id,
        updates: {
          firstName: editing.firstName,
          lastName: editing.lastName,
          address: editing.address,
          phone: editing.phone,
          email: editing.email,
          role: editing.role,
        },
      };
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseMaybeJson(res);
      if (!res.ok) throw new Error(data?.message || 'Failed to update user');

      setUsers((prev) => prev.map(u => (u._id === data.user._id ? data.user : u)));
      toast.success('User updated');
      setEditing(null);
      await loadUsers(roleFilter, currentPage, pageSize, viewMode);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const onArchiveClick = (user) => setArchivingUser(user);
  const onCancelArchive = () => setArchivingUser(null);

  const onConfirmArchive = async () => {
    if (!archivingUser?._id) return;
    setArchiving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: archivingUser._id }),
      });
      const data = await parseMaybeJson(res);
      if (!res.ok) throw new Error(data?.message || 'Failed to archive user');

      await loadUsers(roleFilter, currentPage, pageSize, viewMode);
      toast.success('User archived');
      setArchivingUser(null);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Archive failed');
    } finally {
      setArchiving(false);
    }
  };

  const onRestoreClick = (user) => setRestoringUser(user);
  const onCancelRestore = () => setRestoringUser(null);

  const onConfirmRestore = async () => {
    if (!restoringUser?._id) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/user-restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: restoringUser._id }),
      });
      const data = await parseMaybeJson(res);
      if (!res.ok) throw new Error(data?.message || 'Failed to restore user');

      await loadUsers(roleFilter, currentPage, pageSize, viewMode);
      toast.success('User restored');
      setRestoringUser(null);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const rows = useMemo(() => users, [users]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Check if user can be edited/archived
  const canModifyUser = (user) => {
    if (user.role === 'superadmin') {
      return isSuperAdmin;
    }
    return true;
  };

  // Get role display with badge (now including Rider)
  const getRoleBadge = (role) => {
    if (role === 'superadmin') {
      return (
        <span className="inline-block rounded-full border-2 border-red-500 bg-red-50 px-3 py-0.5 text-xs font-bold text-red-700">
          🛡️ Super Admin
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-block rounded-full border-2 border-blue-500 bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-700">
          Admin
        </span>
      );
    }
    if (role === 'rider') {
      return (
        <span className="inline-block rounded-full border-2 border-emerald-500 bg-emerald-50 px-3 py-0.5 text-xs font-bold text-emerald-700">
          🚚 Rider
        </span>
      );
    }
    return (
      <span className="inline-block rounded-full border px-2 py-0.5 text-xs">
        {role || 'customer'}
      </span>
    );
  };

  // Role options allowed in the ROLE select
  const getAvailableRoleOptions = () => {
    if (isSuperAdmin) {
      // all roles except 'all'
      return ROLE_OPTIONS.filter(r => r.value !== 'all');
    }
    // Regular admins cannot assign superadmin
    return ROLE_OPTIONS.filter(
      r => r.value !== 'all' && r.value !== 'superadmin'
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Sidebar */}
      <aside className="md:col-span-3">
        {/* Mobile dropdown */}
        <div className="md:hidden mb-4">
          <select
            className="w-full rounded-xl border border-[#B08B62]/60 bg-white/80 px-4 py-2 text-zinc-700 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#8B5E34]/60"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop list */}
        <div className="hidden md:block sticky top-6">
          <div className="rounded-2xl border border-white/30 bg-white/60 p-3 backdrop-blur-xl">
            <h3 className="px-2 pb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">
              Filter by role
            </h3>
            <ul className="space-y-1">
              {ROLE_OPTIONS.map((r) => {
                const active = roleFilter === r.value;
                return (
                  <li key={r.value}>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setRoleFilter(r.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setRoleFilter(r.value);
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
                      {r.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 px-2">
              <button
                className="w-full rounded-xl border border-[#B08B62]/50 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-[#8B5E34]/50"
                onClick={() => loadUsers(roleFilter, currentPage, pageSize, viewMode)}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:col-span-9">
        {/* View Mode Toggle */}
        <div className="mb-4 flex gap-2">
          <span
            onClick={() => setViewMode('active')}
            style={{ border: '1px solid gray' }}
            className={[
              'w-full cursor-pointer text-center px-4 py-2 rounded-lg font-semibold transition',
              viewMode === 'active'
                ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white shadow-lg'
                : 'bg-white/60 text-zinc-700 hover:bg-white/80',
            ].join(' ')}
          >
            Active Users
          </span>
          <span
            onClick={() => setViewMode('archived')}
            style={{ border: '1px solid gray' }}
            className={[
              'w-full cursor-pointer text-center px-4 py-2 rounded-lg font-semibold transition',
              viewMode === 'archived'
                ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white shadow-lg'
                : 'bg-white/60 text-zinc-700 hover:bg-white/80',
            ].join(' ')}
          >
            Archived Users
          </span>
        </div>

        {/* Page Size Selector and Total Count */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-600">Show:</label>
            <select
              className="cursor-pointer rounded-lg border border-[#B08B62]/60 bg-white/80 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#8B5E34]/60"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-zinc-600">
            Total: <strong>{totalUsers}</strong> {viewMode === 'active' ? 'active' : 'archived'} users
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/30 bg-white/70 backdrop-blur-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-white/60">
              <tr className="text-left">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={7}>Loading…</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={7}>
                    No {viewMode === 'active' ? 'active' : 'archived'} users found
                  </td>
                </tr>
              )}
              {!loading && rows.map((u) => {
                const canModify = canModifyUser(u);
                return (
                  <tr key={u._id} className="border-t">
                    <td className="px-4 py-3">{(u.firstName || '') + ' ' + (u.lastName || '')}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.phone || ''}</td>
                    <td className="px-4 py-3">{u.address || ''}</td>
                    <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                    <td className="px-4 py-3">
                      {u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      {viewMode === 'active' ? (
                        <>
                          <button
                            className={`mb-2 rounded-md border px-3 py-1 ${
                              canModify
                                ? 'cursor-pointer hover:bg-gray-50'
                                : 'opacity-50 cursor-not-allowed'
                            }`}
                            onClick={() => canModify && onEditClick(u)}
                            disabled={!canModify}
                            title={!canModify ? 'Only super admins can edit super admin accounts' : ''}
                          >
                            Edit
                          </button>
                          <button
                            className={`rounded-md border px-3 py-1 text-orange-600 ${
                              canModify
                                ? 'cursor-pointer hover:bg-orange-50'
                                : 'opacity-50 cursor-not-allowed'
                            }`}
                            onClick={() => canModify && onArchiveClick(u)}
                            disabled={!canModify}
                            title={!canModify ? 'Only super admins can archive super admin accounts' : ''}
                          >
                            Archive
                          </button>
                        </>
                      ) : (
                        <button
                          className="rounded-md border px-3 py-1 text-green-600 cursor-pointer hover:bg-green-50"
                          onClick={() => onRestoreClick(u)}
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-zinc-600">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers}
            </div>
            <div className="flex items-center gap-1">
              <span
                onClick={() => handlePageChange(currentPage - 1)}
                className={`cursor-pointer px-3 py-1.5 rounded-lg border bg-white/80 text-zinc-700 hover:bg-white/90 transition ${
                  currentPage === 1 ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                }`}
              >
                Previous
              </span>
              
              {getPageNumbers().map((page, idx) => (
                page === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-zinc-500">...</span>
                ) : (
                  <span
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={[
                      'cursor-pointer px-3 py-1.5 rounded-lg border transition',
                      currentPage === page
                        ? 'bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] text-white'
                        : 'bg-white/80 text-zinc-700 hover:bg-white/90',
                    ].join(' ')}
                  >
                    {page}
                  </span>
                )
              ))}
              
              <span
                onClick={() => handlePageChange(currentPage + 1)}
                className={`cursor-pointer px-3 py-1.5 rounded-lg border bg-white/80 text-zinc-700 hover:bg-white/90 transition ${
                  currentPage === totalPages ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                }`}
              >
                Next
              </span>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-lg w-full">
              <div className="px-5 py-4 border-b">
                <h2 className="text-lg font-semibold">Edit user</h2>
                {editing.role === 'superadmin' && !editing.isOwnAccount && (
                  <p className="text-xs text-red-600 mt-1">⚠️ Editing Super Admin account</p>
                )}
                {editing.isOwnAccount && (
                  <p className="text-xs text-blue-600 mt-1">ℹ️ Editing your own account</p>
                )}
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">First name</label>
                    <input
                      className="border rounded-md w-full px-3 py-2"
                      value={editing.firstName}
                      onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Last name</label>
                    <input
                      className="border rounded-md w-full px-3 py-2"
                      value={editing.lastName}
                      onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Email</label>
                  <input
                    className="border rounded-md w-full px-3 py-2"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Phone</label>
                  <input
                    className="border rounded-md w-full px-3 py-2"
                    value={editing.phone}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Address</label>
                  <input
                    className="border rounded-md w-full px-3 py-2"
                    value={editing.address}
                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Role</label>
                  <select
                    className="border rounded-md w-full px-3 py-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                    value={editing.role}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                    disabled={editing.isOwnAccount}
                  >
                    {getAvailableRoleOptions().map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  {editing.isOwnAccount && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ You cannot change your own role
                    </p>
                  )}
                  {editing.role === 'superadmin' && !editing.isOwnAccount && (
                    <p className="text-xs text-red-600 mt-1">
                      🛡️ Super Admin has full system access
                    </p>
                  )}
                </div>
              </div>
              <div className="px-5 py-4 border-t flex justify-end gap-2">
                <button
                  className="border rounded-md px-4 py-2 cursor-pointer"
                  onClick={onCloseEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <span
                  style={{ borderRadius: '10px' }}
                  className="bg-primary w-full text-center border-1 text-white rounded-md px-4 py-2 disabled:opacity-60 cursor-pointer"
                  onClick={onSave}
                >
                  {saving ? 'Saving…' : 'Save'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Archive confirm */}
        {archivingUser && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
              <div className="px-5 py-4 border-b">
                <h2 className="text-lg font-semibold">Archive user</h2>
              </div>
              <div className="p-5 space-y-3">
                <p>
                  Are you sure you want to archive{' '}
                  <strong>{(archivingUser.firstName || '') + ' ' + (archivingUser.lastName || '')}</strong>
                  {' '}({archivingUser.email})?
                </p>
                {archivingUser.role === 'superadmin' && (
                  <p className="text-sm text-red-600 font-semibold">
                    ⚠️ Warning: You are archiving a Super Admin account!
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  The user will be hidden from the list but can be restored later if needed.
                </p>
              </div>
              <div className="px-5 py-4 border-t flex justify-end gap-2">
                <button
                  className="border rounded-md px-4 py-2 cursor-pointer"
                  onClick={onCancelArchive}
                  disabled={archiving}
                >
                  Cancel
                </button>
                <span
                  className="cursor-pointer w-full text-center rounded-lg px-4 py-2 font-semibold transition bg-[#AB886D] text-white shadow"
                  onClick={onConfirmArchive}
                >
                  {archiving ? 'Archiving…' : 'Archive'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Restore confirm */}
        {restoringUser && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
              <div className="px-5 py-4 border-b">
                <h2 className="text-lg font-semibold">Restore user</h2>
              </div>
              <div className="p-5 space-y-3">
                <p>
                  Are you sure you want to restore{' '}
                  <strong>{(restoringUser.firstName || '') + ' ' + (restoringUser.lastName || '')}</strong>
                  {' '}({restoringUser.email})?
                </p>
                <p className="text-sm text-gray-600">
                  The user will be moved back to the active users list.
                </p>
              </div>
              <div className="px-5 py-4 border-t flex justify-end gap-2">
                <button
                  className="border rounded-md px-4 py-2 cursor-pointer"
                  onClick={onCancelRestore}
                  disabled={restoring}
                >
                  Cancel
                </button>
                <span
                  className="cursor-pointer w-full text-center rounded-lg px-4 py-2 font-semibold transition bg-green-600 text-white shadow"
                  onClick={onConfirmRestore}
                >
                  {restoring ? 'Restoring…' : 'Restore'}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
