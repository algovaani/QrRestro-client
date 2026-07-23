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
  XCircle,
  Download
} from 'lucide-react';

const STATUS_LABELS = {
  in_stock: { label: 'In Stock', className: 'badge-completed', icon: CheckCircle2, color: '#15803d' },
  low_stock: { label: 'Low Stock', className: 'badge-preparing', icon: AlertTriangle, color: '#b45309' },
  out_of_stock: { label: 'Out of Stock', className: 'badge-cancelled', icon: XCircle, color: '#dc2626' }
};

const emptyForm = {
  addMode: 'custom',
  menuItemId: '',
  customItemName: '',
  quantity: '0',
  lowStockThreshold: '10',
  unit: 'pcs'
};

export default function InventoryPage() {
  const { branchQueryParams, selectedBranchId, selectedBranch, isAllBranches, branches } = useBranch();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 });
  const [untracked, setUntracked] = useState([]);
  const [menuOptionsLoading, setMenuOptionsLoading] = useState(false);
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

  const loadMenuOptionsForBranch = useCallback(async (branchId) => {
    if (!branchId) {
      setUntracked([]);
      return [];
    }
    setMenuOptionsLoading(true);
    try {
      const res = await API.get('/inventory/untracked', { params: { branchId } });
      const list = res.data?.items || [];
      setUntracked(list);
      return list;
    } catch (err) {
      setUntracked([]);
      throw err;
    } finally {
      setMenuOptionsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (resolvedBranchId) {
      loadMenuOptionsForBranch(resolvedBranchId).catch(() => {});
    } else {
      setUntracked([]);
    }
  }, [resolvedBranchId, loadMenuOptionsForBranch]);

  const handleOpenAdd = async () => {
    if (branches.length === 0) {
      alert('Pehle Branches page se ek branch banayein.');
      return;
    }

    const defaultBranch = resolvedBranchId || (branches.length === 1 ? String(branches[0]._id) : '');
    setModalBranchId(defaultBranch);
    setEditingItem(null);
    setFormData({ ...emptyForm, addMode: untracked.length > 0 ? 'menu' : 'custom' });
    setModalError('');
    setShowModal(true);

    if (defaultBranch) {
      try {
        const list = await loadMenuOptionsForBranch(defaultBranch);
        if (list.length === 0) {
          setFormData((prev) => ({ ...prev, addMode: 'custom' }));
        }
      } catch (err) {
        setModalError(err.response?.data?.message || 'Menu items load nahi ho paye — custom item add kar sakte hain.');
        setFormData((prev) => ({ ...prev, addMode: 'custom' }));
      }
    }
  };

  const handleModalBranchChange = async (branchId) => {
    setModalBranchId(branchId);
    setFormData((prev) => ({ ...prev, menuItemId: '', customItemName: '' }));
    if (!branchId) {
      setUntracked([]);
      return;
    }
    try {
      const list = await loadMenuOptionsForBranch(branchId);
      setFormData((prev) => ({ ...prev, addMode: list.length > 0 ? prev.addMode : 'custom' }));
    } catch (err) {
      setModalError(err.response?.data?.message || 'Branch ke menu load nahi ho paye.');
      setFormData((prev) => ({ ...prev, addMode: 'custom' }));
    }
  };

  const handleMenuItemPick = (menuItemId) => {
    const picked = untracked.find((m) => String(m._id) === String(menuItemId));
    setFormData((prev) => ({
      ...prev,
      menuItemId,
      quantity: picked?.currentQuantity != null ? String(picked.currentQuantity) : prev.quantity || '0'
    }));
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setModalBranchId(String(item.branchId || ''));
    setFormData({
      addMode: item.menuItemId ? 'menu' : 'custom',
      menuItemId: item.menuItemId || '',
      customItemName: item.customItemName || item.itemName || '',
      quantity: String(item.quantity ?? 0),
      lowStockThreshold: String(item.lowStockThreshold ?? 10),
      unit: item.unit || 'pcs'
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
    setSaving(true);
    setModalError('');
    try {
      const payload = {
        branchId,
        quantity: Number(formData.quantity) || 0,
        lowStockThreshold: Number(formData.lowStockThreshold) || 10,
        unit: formData.unit || 'pcs'
      };

      if (editingItem) {
        if (editingItem.menuItemId) payload.menuItemId = editingItem.menuItemId;
        else payload.customItemName = editingItem.customItemName || editingItem.itemName;
      } else if (formData.addMode === 'menu') {
        if (!formData.menuItemId) {
          setModalError('Menu item select karein.');
          setSaving(false);
          return;
        }
        payload.menuItemId = formData.menuItemId;
      } else {
        const name = formData.customItemName.trim();
        if (!name) {
          setModalError('Item ka naam likhein.');
          setSaving(false);
          return;
        }
        payload.customItemName = name;
      }

      await API.post('/inventory', payload);
      setShowModal(false);
      await fetchInventory();
      if (branchId) await loadMenuOptionsForBranch(branchId).catch(() => {});
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
    if (!window.confirm(`"${item.itemName}" ka stock tracking hata den?`)) return;
    try {
      await API.delete(`/inventory/${item._id}`);
      await fetchInventory();
      if (item.branchId) await loadMenuOptionsForBranch(String(item.branchId)).catch(() => {});
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    }
  };

  const handleInitBranch = async () => {
    const branchId = resolvedBranchId;
    if (!branchId) {
      alert('Pehle header se ek branch select karein.');
      return;
    }
    const branchName = selectedBranch?.branchName || branches.find((b) => String(b._id) === branchId)?.branchName || 'branch';
    if (!window.confirm(`"${branchName}" ke liye saare menu items inventory mein add karein? (0 stock se start)`)) return;
    setActionLoading('init');
    try {
      const res = await API.post('/inventory/init-branch', {
        branchId,
        defaultQuantity: 0,
        lowStockThreshold: 10
      });
      alert(res.data.message || 'Done');
      await fetchInventory();
      await loadMenuOptionsForBranch(branchId).catch(() => {});
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to initialize inventory');
    } finally {
      setActionLoading('');
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
        <Header title="Inventory & Stock" />
        <div className="admin-content">

          <div className="admin-action-bar" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '640px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Branch-wise stock manage karein — kaunsi item kitni hai aur kaunsi khatam hone wali hai.
                {isAllBranches && branches.length > 1 && ' Header se branch filter kar sakte hain.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" onClick={fetchInventory} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshCw size={16} />
              </button>
              {resolvedBranchId && (
                <button
                  type="button"
                  onClick={handleInitBranch}
                  disabled={actionLoading === 'init'}
                  className="btn btn-secondary btn-sm"
                >
                  <Download size={16} />
                  Load Menu Items
                </button>
              )}
              <button type="button" onClick={handleOpenAdd} className="btn btn-primary btn-sm">
                <Plus size={16} />
                Add Stock Item
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {statCard('Total Tracked', summary.total, 'var(--secondary)', Package)}
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
                  placeholder="Search item, category, branch..."
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
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>STOCK</th>
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
                        {isAllBranches
                          ? 'Koi inventory nahi mili. Branch select karke "Load Menu Items" use karein.'
                          : 'Is branch mein abhi stock track nahi ho raha. "Load Menu Items" ya "Add Stock Item" se shuru karein.'}
                      </td>
                    </tr>
                  ) : items.map((item) => {
                    const statusMeta = STATUS_LABELS[item.stockStatus] || STATUS_LABELS.in_stock;
                    const StatusIcon = statusMeta.icon;
                    return (
                      <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: '700' }}>{item.itemName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.categoryName || '—'}</div>
                        </td>
                        {isAllBranches && (
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>{item.branchName}</td>
                        )}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ fontSize: '1rem' }}>{item.quantity}</strong>
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
              {editingItem ? `Edit Stock — ${editingItem.itemName}` : 'Add Stock Item'}
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
                    onChange={(e) => handleModalBranchChange(e.target.value)}
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
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${formData.addMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFormData({ ...formData, addMode: 'custom', menuItemId: '' })}
                    >
                      Custom Item
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${formData.addMode === 'menu' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFormData({ ...formData, addMode: 'menu', customItemName: '' })}
                      disabled={untracked.length === 0 && !menuOptionsLoading}
                    >
                      Menu Item
                    </button>
                  </div>

                  {formData.addMode === 'custom' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Item Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.customItemName}
                        onChange={(e) => setFormData({ ...formData, customItemName: e.target.value })}
                        placeholder="e.g. Paneer, Oil, Rice bag, Napkins"
                        style={{ width: '100%' }}
                      />
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                        Raw material / ingredient jo menu mein na ho — custom add kar sakte hain.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Menu Item *</label>
                      {menuOptionsLoading ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Menu items load ho rahe hain...</p>
                      ) : (
                        <select
                          required
                          value={formData.menuItemId}
                          onChange={(e) => handleMenuItemPick(e.target.value)}
                          style={{ width: '100%' }}
                          disabled={!modalBranchId && branches.length > 1}
                        >
                          <option value="">Select menu item</option>
                          {untracked.map((m) => (
                            <option key={m._id} value={m._id}>
                              {m.name}{m.categoryName ? ` (${m.categoryName})` : ''}{m.alreadyTracked ? ' — update stock' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      {untracked.length === 0 && !menuOptionsLoading && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                          Menu items nahi mile. Branch login se menu banayein, ya Custom Item use karein.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="admin-form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Current Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="pcs, kg, plates..."
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  Low Stock Alert (kam se kam itna bache to warning)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingItem ? 'Update Stock' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
