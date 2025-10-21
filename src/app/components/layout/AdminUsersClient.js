'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: 'all',        label: 'All roles' },
  { value: 'customer',   label: 'Customer' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'cashier',    label: 'Cashier' },
  { value: 'admin',      label: 'Admin' },
];

const parseMaybeJson = async (res) => {
  // Try JSON; if not JSON, fall back to text for a helpful error
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await res.json();
  }
  const text = await res.text();
  return { message: text || `${res.status} ${res.statusText}` };
};

export default function AdminUsersClient() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deletingUser, setDeletingUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadUsers(role = roleFilter) {
    setLoading(true);
    try {
      const qs = role && role !== 'all' ? `?role=${encodeURIComponent(role)}` : '';
      const res = await fetch(`/api/users${qs}`, { cache: 'no-store' });
      const data = await parseMaybeJson(res);
      if (!res.ok) throw new Error(data?.message || 'Failed fetching users');
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUsers(roleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const onEditClick = (user) => {
    setEditing({
      ...user,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      address: user.address || '',
      phone: user.phone || '',
      email: user.email || '',
      role: user.role || (user.admin ? 'admin' : 'customer'),
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
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteClick = (user) => setDeletingUser(user);
  const onCancelDelete = () => setDeletingUser(null);

  const onConfirmDelete = async () => {
    if (!deletingUser?._id) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: deletingUser._id }),
      });
      const data = await parseMaybeJson(res);
      if (!res.ok) throw new Error(data?.message || 'Failed to delete user');

      setUsers((prev) => prev.filter(u => u._id !== deletingUser._id));
      toast.success('User deleted');
      setDeletingUser(null);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const rows = useMemo(() => users, [users]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Filter by role</label>
        <select
          className="border rounded-md px-3 py-2 cursor-pointer"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          {ROLE_OPTIONS.map((r) => (
            <option className='cursor-pointer' key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
        style={{maxWidth:'300px'}}
          className="ml-auto border rounded-md px-3 py-2 cursor-pointer"
          onClick={() => loadUsers(roleFilter)}
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Address</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Actions</th>
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
                <td className="px-4 py-4 text-gray-500" colSpan={7}>No users</td>
              </tr>
            )}
            {!loading && rows.map((u) => (
              <tr key={u._id} className="border-t">
                <td className="px-4 py-3">{(u.firstName || '') + ' ' + (u.lastName || '')}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.phone || ''}</td>
                <td className="px-4 py-3">{u.address || ''}</td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs border">
                    {u.role || (u.admin ? 'admin' : 'customer')}
                  </span>
                </td>
                <td className="px-4 py-3">{new Date(u.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 space-x-2">
                  <button className="border rounded-md px-3 py-1 cursor-pointer mb-2" onClick={() => onEditClick(u)}>
                    Edit
                  </button>
                  <button className="border rounded-md px-3 py-1 text-red-600 cursor-pointer" onClick={() => onDeleteClick(u)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full">
            <div className="px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Edit user</h2>
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
                  className="border rounded-md w-full px-3 py-2 cursor-pointer"
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                >
                  {ROLE_OPTIONS.filter(r => r.value !== 'all').map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button className="border rounded-md px-4 py-2 cursor-pointer" onClick={onCloseEdit} disabled={saving}>
                Cancel
              </button>
              <button
                className="bg-primary text-white rounded-md px-4 py-2 disabled:opacity-60 cursor-pointer"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Delete user</h2>
            </div>
            <div className="p-5 space-y-3">
              <p>
                Are you sure you want to delete{' '}
                <strong>{(deletingUser.firstName || '') + ' ' + (deletingUser.lastName || '')}</strong>
                {' '}({deletingUser.email})?
              </p>
              <p className="text-sm text-gray-600">This action cannot be undone.</p>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button className="border rounded-md px-4 py-2 cursor-pointer" onClick={onCancelDelete} disabled={deleting}>
                Cancel
              </button>
              <button
                className="bg-red-600 text-white rounded-md px-4 py-2 disabled:opacity-60 cursor-pointer"
                onClick={onConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
