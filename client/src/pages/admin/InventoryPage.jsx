import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useBranch } from '../../context/BranchContext';
import {
  Package,
  Plus,
  Minus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'packet', 'dozen', 'box'];

const STATUS_LABELS = {
  in_stock: { label: 'In Stock', className: 'badge-completed', icon: CheckCircle2, color: '#15803d' },
  low_stock: { label: 'Low Stock', className: 'badge-preparing', icon: AlertTriangle, color: '#b45309' },
  out_of_stock: { label: 'Out of Stock', className: 'badge-cancelled', icon: XCircle, color: '#dc2626' }
};

const emptyForm = {
  customItemName: '',
  quantity: '0',
  lowStockThreshold: '5',
  unit: 'kg'
};

export default function InventoryPage() {
  const { branchQueryParams, selectedBranchId, isAllBranches, branches } = useBranch();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [modalBranchId, setModalBranchId] = useState('');

  const resolvedBranchId = useMemo(() => {
    if (!isAllBranches && selectedBranchId && selectedBranchId !== 'all') {
      return String(selectedBranchId);
    }
    if (branches.length === 1) {
      return String(branches[0]._id);
    }
    return '';
  }, [isAllBranches, selectedBranchId, branches]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...branchQueryParams,
        status: statusFilter,
        search: searchTerm.trim() || undefined
      };
      const res = await API.get('/inventory', { params });
      if (res.data.success) {
        setItems(res.data.items || []);
        setSummary(res.data.summary || { total: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [branchQueryParams, statusFilter, searchTerm]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleOpenAdd = () => {
    if (branches.length === 0) {
      alert('Pehle Branches page se ek branch banayein.');
      return;
    }
    const defaultBranch = resolvedBranchId || (branches.length === 1 ? String(branches[0]._id) : '');
    setModalBranchId(defaultBranch);
    setEditingItem(null);
    setFormData(emptyForm);
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setModalBranchId(String(item.branchId || ''));
    setFormData({
      customItemName: item.customItemName || item.itemName || '',
      quantity: String(item.quantity ?? 0),
      lowStockThreshold: String(item.lowStockThreshold ?? 5),
      unit: item.unit || 'kg'
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const branchId = editingItem?.branchId || modalBranchId || resolvedBranchId;
    if (!branchId) {
      setModalError('Pehle branch select karein.');
      return;
    }
    const name = formData.customItemName.trim();
    if (!name) {
      setModalError('Item ka naam likhein (e.g. Salt, Mirch, Ghee).');
      return;
    }

    setSaving(true);
    setModalError('');
    try {
      await API.post('/inventory', {
        branchId,
        customItemName: editingItem ? (editingItem.customItemName || editingItem.itemName) : name,
        quantity: Number(formData.quantity) || 0,
        lowStockThreshold: Number(formData.lowStockThreshold) || 5,
        unit: formData.unit || 'kg'
      });
      setShowModal(false);
      await fetchInventory();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save inventory');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async (item, adjustment) => {
    setActionLoading(item._id);
    try {
      await API.patch(`/inventory/${item._id}/adjust`, { adjustment });
      await fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setActionLoading('');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.itemName}" stock se hata den?`)) return;
    try {
      await API.delete(`/inventory/${item._id}`);
      await fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    }
  };

  const statCard = (label, value, color, Icon) => (
    <div className="admin-panel admin-panel--padded" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: '800', color }}>{value}</div>
      </div>
      <Icon size={22} color={color} />
    </div>
  );

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Branch Inventory" />
        <div className="admin-content">

          <div className="admin-action-bar" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '640px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Har branch ka kitchen stock yahan manage karein — Salt, Mirch, Ghee, Haldi wagaira.
                Menu dishes se alag. Quantity add/remove karke track karein kitna bacha hai.
                {isAllBranches && branches.length > 1 && ' Header se branch filter kar sakte hain.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" onClick={fetchInventory} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={handleOpenAdd} className="btn btn-primary btn-sm">
                <Plus size={16} />
                Add Stock Item
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {statCard('Total Items', summary.total, 'var(--secondary)', Package)}
            {statCard('In Stock', summary.in_stock, '#15803d', CheckCircle2)}
            {statCard('Low Stock', summary.low_stock, '#b45309', AlertTriangle)}
            {statCard('Out of Stock', summary.out_of_stock, '#dc2626', XCircle)}
          </div>

          <div className="admin-panel">
            <div className="admin-panel--padded admin-toolbar" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="admin-toolbar-search">
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search salt, ghee, branch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', paddingLeft: '38px' }}
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: '150px' }}>
                <option value="all">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            <div className="admin-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  <tr>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>ITEM</th>
                    {isAllBranches && <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>BRANCH</th>}
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>QUANTITY LEFT</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>LOW ALERT</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>STATUS</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isAllBranches ? 6 : 5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading inventory...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={isAllBranches ? 6 : 5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Abhi koi kitchen stock nahi. &quot;Add Stock Item&quot; se Salt, Mirch, Ghee wagaira add karein.
                      </td>
                    </tr>
                  ) : items.map((item) => {
                    const statusMeta = STATUS_LABELS[item.stockStatus] || STATUS_LABELS.in_stock;
                    const StatusIcon = statusMeta.icon;
                    return (
                      <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: '700' }}>{item.itemName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kitchen Stock</div>
                        </td>
                        {isAllBranches && (
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>{item.branchName}</td>
                        )}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ fontSize: '1rem', color: item.stockStatus === 'out_of_stock' || item.stockStatus === 'low_stock' ? statusMeta.color : undefined }}>
                            {item.quantity}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>{item.unit}</span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>{item.lowStockThreshold} {item.unit}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span className={`badge ${statusMeta.className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <StatusIcon size={12} />
                            {statusMeta.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Reduce stock"
                              disabled={actionLoading === item._id}
                              onClick={() => handleAdjust(item, -1)}
                            >
                              <Minus size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Add stock"
                              disabled={actionLoading === item._id}
                              onClick={() => handleAdjust(item, 1)}
                            >
                              <Plus size={14} />
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(item)}>
                              <Edit2 size={14} />
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDelete(item)} style={{ color: 'var(--danger)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
              {editingItem ? `Edit Stock — ${editingItem.itemName}` : 'Add Kitchen Stock'}
            </h3>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!editingItem && branches.length > 1 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Branch *</label>
                  <select
                    required
                    value={modalBranchId}
                    onChange={(e) => setModalBranchId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id} disabled={branch.isActive === false}>
                        {branch.branchName}{branch.isDefault ? ' (Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!editingItem && branches.length === 1 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  Branch: <strong>{branches[0].branchName}</strong>
                </div>
              )}

              {!editingItem && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Item Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customItemName}
                    onChange={(e) => setFormData({ ...formData, customItemName: e.target.value })}
                    placeholder="e.g. Salt, Mirch, Ghee, Haldi, Oil"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div className="admin-form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Quantity Left *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  Low Stock Alert
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Isse kam bache to Low Stock dikhega.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingItem ? 'Update Stock' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
