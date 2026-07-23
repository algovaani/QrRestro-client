import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useBranch } from '../../context/BranchContext';
import { Plus, Edit2, Trash2, MapPin, Star, RefreshCw, QrCode, ShoppingBag, IndianRupee, Clock, LayoutGrid, KeyRound, UserPlus, Copy, Check } from 'lucide-react';

const emptyForm = {
  branchName: '',
  address: '',
  city: '',
  mobile: '',
  isActive: true,
  isDefault: false
};

const emptyManagerForm = {
  name: '',
  email: '',
  password: '',
  isActive: true
};

export default function BranchesPage() {
  const { refreshBranches } = useBranch();
  const [branches, setBranches] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [managerBranch, setManagerBranch] = useState(null);
  const [managerForm, setManagerForm] = useState(emptyManagerForm);
  const [managerError, setManagerError] = useState('');
  const [managerSaving, setManagerSaving] = useState(false);
  const [copiedLogin, setCopiedLogin] = useState(false);

  const branchLoginUrl = `${window.location.origin}/branch/login`;

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await API.get('/branches');
      if (res.data.success) {
        setBranches(res.data.branches || []);
        setTotals(res.data.totals || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setFormData(emptyForm);
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (branch) => {
    setEditingBranch(branch);
    setFormData({
      branchName: branch.branchName || '',
      address: branch.address || '',
      city: branch.city || '',
      mobile: branch.mobile || '',
      isActive: branch.isActive !== false,
      isDefault: Boolean(branch.isDefault)
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);
    try {
      if (editingBranch) {
        await API.put(`/branches/${editingBranch._id}`, formData);
      } else {
        await API.post('/branches', formData);
      }
      setShowModal(false);
      await fetchBranches();
      await refreshBranches();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch) => {
    if (!window.confirm(`Delete branch "${branch.branchName}"? Tables & QR codes in this branch will also be removed.`)) return;
    try {
      await API.delete(`/branches/${branch._id}`);
      await fetchBranches();
      await refreshBranches();
    } catch (err) {
      alert(err.response?.data?.message || 'Cannot delete this branch');
    }
  };

  const openBranchTablesHint = () => {
    window.alert(`Tables & QR codes ab branch manager ${branchLoginUrl} se manage honge.\n\nPehle "Create Branch Login" se branch manager ka account banayein.`);
  };

  const handleOpenManager = (branch) => {
    const mgr = branch.branchManager;
    setManagerBranch(branch);
    setManagerForm({
      name: mgr?.name || '',
      email: mgr?.email || '',
      password: '',
      isActive: mgr?.isActive !== false
    });
    setManagerError('');
    setCopiedLogin(false);
  };

  const handleCloseManager = () => {
    if (managerSaving) return;
    setManagerBranch(null);
    setManagerForm(emptyManagerForm);
    setManagerError('');
  };

  const handleSaveManager = async (e) => {
    e.preventDefault();
    if (!managerBranch) return;
    setManagerError('');
    setManagerSaving(true);
    try {
      const payload = {
        name: managerForm.name.trim(),
        email: managerForm.email.trim(),
        isActive: managerForm.isActive
      };
      if (managerForm.password.trim()) {
        payload.password = managerForm.password;
      }
      await API.put(`/branches/${managerBranch._id}/manager`, payload);
      handleCloseManager();
      await fetchBranches();
    } catch (err) {
      setManagerError(err.response?.data?.message || 'Failed to save branch login');
    } finally {
      setManagerSaving(false);
    }
  };

  const handleDeleteManager = async () => {
    if (!managerBranch?.branchManager) return;
    if (!window.confirm(`Remove branch login for "${managerBranch.branchName}"? Branch manager sign-in band ho jayega.`)) return;
    setManagerSaving(true);
    try {
      await API.delete(`/branches/${managerBranch._id}/manager`);
      handleCloseManager();
      await fetchBranches();
    } catch (err) {
      setManagerError(err.response?.data?.message || 'Failed to remove branch login');
    } finally {
      setManagerSaving(false);
    }
  };

  const copyLoginUrl = async () => {
    try {
      await navigator.clipboard.writeText(branchLoginUrl);
      setCopiedLogin(true);
      setTimeout(() => setCopiedLogin(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const statBox = (label, value, icon, color = 'var(--primary)') => (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.65rem 0.75rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ fontWeight: '800', fontSize: '1rem', color }}>{value}</div>
    </div>
  );

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Restaurant Branches" />
        <div className="admin-content">

          <div className="admin-action-bar" style={{ marginBottom: '1.25rem', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '620px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                Har branch alag location hai — uske apne <strong>Tables & QR Codes</strong>, <strong>Menu</strong>, <strong>Kitchen</strong> aur alag <strong>Branch Login</strong> hote hain.
                Yahan se branches aur branch logins manage karein; daily ops branch manager karega.
              </p>
              {totals && branches.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                  {statBox('Total Tables', totals.tableCount, <LayoutGrid size={13} />)}
                  {statBox('Today Orders', totals.todayOrders, <ShoppingBag size={13} />)}
                  {statBox('Today Revenue', `₹${totals.todayRevenue}`, <IndianRupee size={13} />, 'var(--success)')}
                  {statBox('Pending', totals.pendingOrders, <Clock size={13} />, totals.pendingOrders > 0 ? 'var(--danger)' : 'var(--text-muted)')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button type="button" onClick={fetchBranches} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={handleOpenAdd} className="btn btn-primary">
                <Plus size={18} />
                <span>Add Branch</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading branches...</div>
          ) : branches.length === 0 ? (
            <div className="admin-panel admin-panel--padded" style={{ textAlign: 'center' }}>
              <MapPin size={40} style={{ color: 'var(--primary)', marginBottom: '0.75rem' }} />
              <h3 style={{ marginBottom: '0.5rem' }}>No branches yet</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Create your first branch to get started.</p>
              <button type="button" onClick={handleOpenAdd} className="btn btn-primary">Add Branch</button>
            </div>
          ) : (
            <div className="admin-grid-cards">
              {branches.map((branch) => {
                const s = branch.stats || {};
                return (
                  <div
                    key={branch._id}
                    className="admin-panel admin-panel--padded"
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {branch.branchName}
                          {branch.isDefault && (
                            <span title="Default branch" style={{ color: 'var(--primary)' }}>
                              <Star size={16} fill="currentColor" />
                            </span>
                          )}
                        </h3>
                        <span className={`badge ${branch.isActive !== false ? 'badge-completed' : 'badge-cancelled'}`}>
                          {branch.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button type="button" onClick={() => handleOpenEdit(branch)} className="btn btn-secondary btn-sm" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        {!branch.isDefault && (
                          <button type="button" onClick={() => handleDelete(branch)} className="btn btn-secondary btn-sm" title="Delete" style={{ color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {branch.address && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {branch.address}{branch.city ? `, ${branch.city}` : ''}
                      </p>
                    )}
                    {branch.mobile && (
                      <p style={{ fontSize: '0.85rem' }}>📞 {branch.mobile}</p>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                      {statBox('Tables / QR', s.tableCount ?? 0, <QrCode size={12} />)}
                      {statBox('Today Orders', s.todayOrders ?? 0, <ShoppingBag size={12} />)}
                      {statBox('Revenue', `₹${s.todayRevenue ?? 0}`, <IndianRupee size={12} />, 'var(--success)')}
                      {statBox('Pending', s.pendingOrders ?? 0, <Clock size={12} />, (s.pendingOrders ?? 0) > 0 ? 'var(--danger)' : 'var(--text-muted)')}
                    </div>

                    <div style={{
                      background: branch.branchManager ? '#ecfdf5' : '#f8fafc',
                      border: `1px solid ${branch.branchManager ? '#a7f3d0' : 'var(--border)'}`,
                      borderRadius: '10px',
                      padding: '0.65rem 0.75rem',
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: '700', marginBottom: '0.25rem', color: branch.branchManager ? '#047857' : 'var(--text-muted)' }}>
                        <KeyRound size={14} />
                        Branch Login
                      </div>
                      {branch.branchManager ? (
                        <>
                          <div style={{ color: 'var(--secondary)' }}>{branch.branchManager.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{branch.branchManager.email}</div>
                          {!branch.branchManager.isActive && (
                            <span className="badge badge-cancelled" style={{ marginTop: '0.35rem', display: 'inline-block' }}>Login Disabled</span>
                          )}
                        </>
                      ) : (
                        <div style={{ color: 'var(--text-muted)' }}>Abhi branch manager login nahi bana</div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenManager(branch)}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%' }}
                    >
                      <UserPlus size={15} />
                      {branch.branchManager ? 'Edit Branch Login' : 'Create Branch Login'}
                    </button>

                    <button
                      type="button"
                      onClick={openBranchTablesHint}
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                    >
                      <QrCode size={15} />
                      Tables & QR — Branch Login se manage
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
              {editingBranch ? 'Edit Branch' : 'Add New Branch'}
            </h3>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Branch Name *</label>
                <input
                  type="text"
                  required
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                  placeholder="e.g. MG Road, Sector 18"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="admin-form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Mobile</label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="10-digit mobile"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Branch is active
                </label>
                {editingBranch && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    />
                    Set as default branch
                  </label>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {managerBranch && (
        <div className="modal-overlay" onClick={handleCloseManager}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.35rem' }}>
              Branch Login — {managerBranch.branchName}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Is branch ke manager alag email/password se login karenge. Sirf is branch ke orders, tables & reports dikhenge.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#f8fafc',
              borderRadius: '10px',
              padding: '0.65rem 0.75rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              border: '1px solid var(--border)'
            }}>
              <code style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branchLoginUrl}</code>
              <button type="button" className="btn btn-secondary btn-sm" onClick={copyLoginUrl} title="Copy login URL">
                {copiedLogin ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            {managerError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {managerError}
              </div>
            )}

            <form onSubmit={handleSaveManager} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Manager Name *</label>
                <input
                  type="text"
                  required
                  value={managerForm.name}
                  onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })}
                  placeholder="e.g. Rajesh Kumar"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Login Email *</label>
                <input
                  type="email"
                  required
                  value={managerForm.email}
                  onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })}
                  placeholder="mgroad@restaurant.com"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  {managerBranch.branchManager ? 'New Password (optional)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!managerBranch.branchManager}
                  minLength={6}
                  value={managerForm.password}
                  onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })}
                  placeholder={managerBranch.branchManager ? 'Change karne ke liye likhein' : 'Minimum 6 characters'}
                  style={{ width: '100%' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={managerForm.isActive}
                  onChange={(e) => setManagerForm({ ...managerForm, isActive: e.target.checked })}
                />
                Branch login active
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <div>
                  {managerBranch.branchManager && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleDeleteManager}
                      disabled={managerSaving}
                      style={{ color: 'var(--danger)' }}
                    >
                      Remove Login
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleCloseManager} disabled={managerSaving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={managerSaving}>
                    {managerSaving ? 'Saving...' : managerBranch.branchManager ? 'Update Login' : 'Create Login'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
