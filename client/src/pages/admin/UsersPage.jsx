import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Plus, Search, Edit2, Trash2, UserCheck, UserX, Shield } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    role: 'Waiter',
    status: 'Active'
  });
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  const fetchUsers = async () => {
    try {
      const res = await API.get('/users', {
        params: { search, role: roleFilter }
      });
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      mobile: '',
      password: '',
      role: 'Waiter',
      status: 'Active'
    });
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      mobile: user.mobile || '',
      password: '',
      role: user.role,
      status: user.status
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      if (editingUser) {
        await API.put(`/users/${editingUser._id}`, formData);
      } else {
        await API.post('/users', formData);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error saving user');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff user?')) return;
    try {
      await API.delete(`/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting user');
    }
  };

  const toggleStatus = async (user) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await API.put(`/users/${user._id}`, { status: newStatus });
      fetchUsers();
    } catch (err) {
      alert('Error updating status');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="User Management" />
        <div className="admin-content">

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '1rem', flex: 1, maxWidth: '500px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by name, email, mobile..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '38px' }}
                />
              </div>

              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Kitchen Staff">Kitchen Staff</option>
                <option value="Waiter">Waiter</option>
              </select>
            </div>

            <button onClick={handleOpenAdd} className="btn btn-primary">
              <Plus size={18} />
              <span>Add Staff User</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="admin-panel">
            <div className="admin-table-wrap">
            <table className="admin-table-compact" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <tr>
                  <th style={{ padding: '0.8rem 1rem' }}>NAME</th>
                  <th style={{ padding: '0.8rem 1rem' }}>EMAIL</th>
                  <th style={{ padding: '0.8rem 1rem' }}>MOBILE</th>
                  <th style={{ padding: '0.8rem 1rem' }}>ROLE</th>
                  <th style={{ padding: '0.8rem 1rem' }}>STATUS</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>{u.name}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '1rem' }}>{u.mobile || '-'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>
                        <Shield size={12} color="var(--primary)" />
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${u.status === 'Active' ? 'badge-completed' : 'badge-cancelled'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button onClick={() => toggleStatus(u)} title={u.status === 'Active' ? 'Deactivate' : 'Activate'} className="btn btn-secondary btn-sm">
                          {u.status === 'Active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => handleOpenEdit(u)} className="btn btn-secondary btn-sm" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(u._id)} className="btn btn-danger btn-sm" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No staff users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem' }}>
              {editingUser ? 'Edit User' : 'Add Staff User'}
            </h3>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Mobile Number</label>
                <input
                  type="text"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="admin-form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Kitchen Staff">Kitchen Staff</option>
                    <option value="Waiter">Waiter</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
