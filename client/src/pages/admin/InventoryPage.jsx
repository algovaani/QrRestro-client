import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { isBranchAdmin } from '../../utils/adminPaths';
import {
  Plus,
  Minus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Loader2
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

const emptySummary = { total: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 };

export default function InventoryPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const branchMode = isBranchAdmin(user);
  const {
    branches,
    setSelectedBranchId,
    getBranchName,
    hasMultipleBranches,
    isBranchLocked
  } = useBranch();

  const [stockBranchId, setStockBranchId] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [pickerGroups, setPickerGroups] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  // Same pattern as Orders page
  const showBranchPicker = hasMultipleBranches && !isBranchLocked && !stockBranchId;
  const selectedBranchName = stockBranchId ? getBranchName(stockBranchId) : '';

  const selectedBranchMeta = useMemo(
    () => branches.find((b) => String(b._id) === String(stockBranchId)) || null,
    [branches, stockBranchId]
  );
  const branchLocked = Boolean(
    selectedBranchMeta?.suspendedByLimit || selectedBranchMeta?.isActive === false
  );

  // Init branch scope — same UX as Orders (picker first for multi-branch admin)
  useEffect(() => {
    const fromUrl = searchParams.get('branchId');
    if (fromUrl) {
      setStockBranchId(String(fromUrl));
      setSelectedBranchId(String(fromUrl));
      return;
    }

    if (isBranchLocked && user?.branchId) {
      setStockBranchId(String(user.branchId));
      return;
    }

    if (!hasMultipleBranches && branches.length === 1) {
      setStockBranchId(String(branches[0]._id));
      return;
    }

    if (hasMultipleBranches && !isBranchLocked) {
      // Entering Kitchen Stock: always start with branch picker (like Orders)
      setStockBranchId(null);
      setSelectedBranchId('all');
      setItems([]);
      setSummary(emptySummary);
    }
    // Only re-run when navigating to this page — not when branches list refreshes after select
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Keep single-branch / branch-manager lock in sync once branches load
  useEffect(() => {
    if (searchParams.get('branchId')) return;
    if (isBranchLocked && user?.branchId) {
      setStockBranchId(String(user.branchId));
      return;
    }
    if (!hasMultipleBranches && branches.length === 1 && !stockBranchId) {
      setStockBranchId(String(branches[0]._id));
    }
  }, [isBranchLocked, hasMultipleBranches, branches, user?.branchId, searchParams, stockBranchId]);

  // Branch picker stats — all branches summary (like Orders stats fetch)
  useEffect(() => {
    if (!showBranchPicker) return;
    setPickerLoading(true);
    API.get('/inventory')
      .then((res) => {
        if (!res.data.success) return;
        const byBranch = res.data.byBranch || [];
        const groups = (branches.length ? branches : byBranch.map((b) => ({
          _id: b.branchId,
          branchName: b.branchName,
          suspendedByLimit: b.suspendedByLimit,
          isActive: b.branchActive !== false
        }))).map((branch) => {
          const id = String(branch._id || branch.branchId);
          const match = byBranch.find((b) => String(b.branchId) === id);
          return {
            branchId: id,
            branchName: branch.branchName || match?.branchName || 'Branch',
            suspendedByLimit: Boolean(branch.suspendedByLimit ?? match?.suspendedByLimit),
            isActive: branch.isActive !== false && match?.branchActive !== false,
            total: match?.total || 0,
            in_stock: match?.in_stock || 0,
            low_stock: match?.low_stock || 0,
            out_of_stock: match?.out_of_stock || 0
          };
        });
        setPickerGroups(groups);
      })
      .catch(console.error)
      .finally(() => setPickerLoading(false));
  }, [showBranchPicker, user?._id, branches]);

  const fetchInventory = useCallback(async () => {
    if (!stockBranchId) {
      setItems([]);
      setSummary(emptySummary);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await API.get('/inventory', {
        params: {
          branchId: stockBranchId,
          status: statusFilter,
          search: searchTerm.trim() || undefined
        }
      });
      if (res.data.success) {
        setItems(res.data.items || []);
        setSummary(res.data.summary || emptySummary);
      }
    } catch (err) {
      console.error(err);
      setItems([]);
      setSummary(emptySummary);
    } finally {
      setLoading(false);
    }
  }, [stockBranchId, statusFilter, searchTerm]);

  useEffect(() => {
    if (showBranchPicker) return;
    fetchInventory();
  }, [fetchInventory, showBranchPicker]);

  const handleSelectBranch = (branchId) => {
    setStockBranchId(String(branchId));
    setSelectedBranchId(String(branchId));
    setSearchTerm('');
    setStatusFilter('all');
  };

  const handleChangeBranch = () => {
    setStockBranchId(null);
    setSelectedBranchId('all');
    setItems([]);
    setSummary(emptySummary);
    setSearchTerm('');
    setStatusFilter('all');
  };

  const handleOpenAdd = () => {
    if (!stockBranchId) {
      alert('Please select a branch first.');
      return;
    }
    if (branchLocked) {
      alert('This branch is suspended because it exceeds your branch limit. Kitchen stock cannot be changed.');
      return;
    }
    setEditingItem(null);
    setFormData(emptyForm);
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    if (branchLocked || item.suspendedByLimit) {
      alert('This branch is suspended because it exceeds your branch limit. Kitchen stock cannot be changed.');
      return;
    }
    setEditingItem(item);
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
    const branchId = editingItem?.branchId || stockBranchId;
    if (!branchId) {
      setModalError('Please select a branch first.');
      return;
    }
    const name = formData.customItemName.trim();
    if (!name) {
      setModalError('Please enter an item name (e.g. Salt, Pepper, Ghee).');
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
    if (branchLocked || item.suspendedByLimit) {
      alert('This branch is suspended because it exceeds your branch limit. Kitchen stock cannot be changed.');
      return;
    }
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
    if (!window.confirm(`Remove "${item.itemName}" from stock?`)) return;
    try {
      await API.delete(`/inventory/${item._id}`);
      await fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header
          title={showBranchPicker ? 'Select Branch' : `Kitchen Stock — ${selectedBranchName || user?.branchName || 'Branch'}`}
          hideBranchSelector
          branchLabel={showBranchPicker ? '' : (selectedBranchName || user?.branchName || '')}
        />
        <div className="admin-content">

          {showBranchPicker ? (
            <div>
              <div className="admin-panel admin-panel--padded" style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--secondary)' }}>
                  Select a branch to view kitchen stock
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Kitchen stock is shown one branch at a time. Choose the branch you want to manage.
                </p>
              </div>

              {pickerLoading ? (
                <div className="admin-panel admin-panel--padded" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  Loading branches...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {pickerGroups.map((group) => {
                    const isSuspended = Boolean(group.suspendedByLimit) || group.isActive === false;
                    return (
                      <button
                        key={group.branchId}
                        type="button"
                        onClick={() => !isSuspended && handleSelectBranch(group.branchId)}
                        disabled={isSuspended}
                        className="admin-panel admin-panel--padded"
                        style={{
                          textAlign: 'left',
                          cursor: isSuspended ? 'not-allowed' : 'pointer',
                          opacity: isSuspended ? 0.65 : 1,
                          border: `1px solid ${isSuspended ? '#fecaca' : 'var(--border)'}`,
                          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={18} color={isSuspended ? '#b45309' : 'var(--primary)'} />
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--secondary)' }}>
                              {group.branchName}
                            </span>
                          </div>
                          {!isSuspended && <ArrowRight size={18} color="var(--primary)" />}
                        </div>

                        {isSuspended && (
                          <div style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 700 }}>
                            Suspended — exceeds branch limit. Delete this branch or ask Super Admin to increase limit.
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                          <div style={{ background: '#f0fdf4', padding: '0.55rem 0.65rem', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>In Stock</div>
                            <div style={{ fontWeight: 800, color: '#15803d' }}>{group.in_stock} items</div>
                          </div>
                          <div style={{ background: '#eff6ff', padding: '0.55rem 0.65rem', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Low / Out</div>
                            <div style={{ fontWeight: 800, color: '#1d4ed8' }}>
                              {group.low_stock} / {group.out_of_stock}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Total: <strong>{group.total}</strong> stock items
                        </div>

                        <span
                          className={`btn btn-sm ${isSuspended ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          {isSuspended ? 'Not Available' : 'View Stock'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!pickerLoading && pickerGroups.length === 0 && (
                <div className="admin-panel admin-panel--padded" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No branches found. Add branches from the Branches page.
                </div>
              )}
            </div>
          ) : (
            <>
              {hasMultipleBranches && !isBranchLocked && (
                <button
                  type="button"
                  onClick={handleChangeBranch}
                  className="btn btn-secondary btn-sm"
                  style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <ArrowLeft size={16} /> Change Branch
                </button>
              )}

              <div className="admin-action-bar" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
                <div style={{ maxWidth: '720px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    {branchMode
                      ? 'Manage kitchen stock for your branch — salt, oil, ghee, and similar items.'
                      : `Showing kitchen stock for ${selectedBranchName || 'this branch'} only.`}
                  </p>
                  {branchLocked && (
                    <p style={{ fontSize: '0.82rem', color: '#b45309', fontWeight: 700, margin: 0 }}>
                      This branch is suspended (over plan limit). Stock is view-only.
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={fetchInventory} className="btn btn-secondary btn-sm" title="Refresh">
                    <RefreshCw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="btn btn-primary btn-sm"
                    disabled={branchLocked || !stockBranchId}
                  >
                    <Plus size={16} />
                    Add Stock Item
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Items</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{summary.total}</div>
                </div>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #15803d' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>In Stock</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>{summary.in_stock}</div>
                </div>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #b45309' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Low Stock</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b45309' }}>{summary.low_stock}</div>
                </div>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #dc2626' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Out of Stock</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>{summary.out_of_stock}</div>
                </div>
              </div>

              <div className="admin-panel">
                <div className="admin-panel--padded admin-toolbar" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="admin-toolbar-search">
                    <Search
                      size={18}
                      style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      placeholder="Search salt, ghee, oil..."
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
                    <thead
                      style={{
                        background: '#f8fafc',
                        borderBottom: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem'
                      }}
                    >
                      <tr>
                        <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>ITEM</th>
                        <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>QUANTITY LEFT</th>
                        <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>LOW ALERT</th>
                        <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>STATUS</th>
                        <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Loading inventory...
                          </td>
                        </tr>
                      ) : items.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No kitchen stock yet for this branch. Use &quot;Add Stock Item&quot; to add items.
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => {
                          const statusMeta = STATUS_LABELS[item.stockStatus] || STATUS_LABELS.in_stock;
                          const StatusIcon = statusMeta.icon;
                          const locked = branchLocked || Boolean(item.suspendedByLimit);
                          return (
                            <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9', opacity: locked ? 0.65 : 1 }}>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ fontWeight: '700' }}>{item.itemName}</div>
                                <div style={{ fontSize: '0.75rem', color: locked ? '#b45309' : 'var(--text-muted)' }}>
                                  {locked ? 'Suspended branch — stock locked' : 'Kitchen Stock'}
                                </div>
                              </td>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <strong
                                  style={{
                                    fontSize: '1rem',
                                    color:
                                      item.stockStatus === 'out_of_stock' || item.stockStatus === 'low_stock'
                                        ? statusMeta.color
                                        : undefined
                                  }}
                                >
                                  {item.quantity}
                                </strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                                  {item.unit}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                {item.lowStockThreshold} {item.unit}
                              </td>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <span
                                  className={`badge ${statusMeta.className}`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <StatusIcon size={12} />
                                  {statusMeta.label}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={locked || actionLoading === item._id}
                                    onClick={() => handleAdjust(item, -1)}
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={locked || actionLoading === item._id}
                                    onClick={() => handleAdjust(item, 1)}
                                  >
                                    <Plus size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={locked}
                                    onClick={() => handleOpenEdit(item)}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleDelete(item)}
                                    style={{ color: 'var(--danger)' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
              {editingItem ? `Edit Stock — ${editingItem.itemName}` : 'Add Kitchen Stock'}
            </h3>

            {modalError && (
              <div
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem'
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  padding: '0.5rem 0.75rem',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}
              >
                Branch: <strong>{selectedBranchName || user?.branchName || 'Branch'}</strong>
              </div>

              {!editingItem && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customItemName}
                    onChange={(e) => setFormData({ ...formData, customItemName: e.target.value })}
                    placeholder="e.g. Salt, Pepper, Ghee, Turmeric, Oil"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div className="admin-form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                    Quantity Left *
                  </label>
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
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                    Unit
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
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
                  Items below this threshold will show as Low Stock.
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
