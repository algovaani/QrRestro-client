import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { isBranchAdmin } from '../../utils/adminPaths';
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
  MapPin
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const branchMode = isBranchAdmin(user);
  const {
    branchQueryParams,
    selectedBranchId,
    isAllBranches,
    branches,
    setSelectedBranchId,
    getBranchName,
    selectedBranch
  } = useBranch();
  const [items, setItems] = useState([]);
  const [byBranch, setByBranch] = useState([]);
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

  useEffect(() => {
    const fromUrl = searchParams.get('branchId');
    if (fromUrl) {
      setSelectedBranchId(fromUrl);
    }
  }, [searchParams, setSelectedBranchId]);

  const resolvedBranchId = useMemo(() => {
    if (!isAllBranches && selectedBranchId && selectedBranchId !== 'all') {
      return String(selectedBranchId);
    }
    if (branches.length === 1) {
      return String(branches[0]._id);
    }
    return '';
  }, [isAllBranches, selectedBranchId, branches]);

  const showGroupedByBranch = !branchMode && isAllBranches && branches.length > 1;

  const operationalBranches = useMemo(
    () => branches.filter((b) => b.isActive !== false && !b.suspendedByLimit),
    [branches]
  );

  const isBranchStockLocked = useCallback(
    (branchId) => {
      const branch = branches.find((b) => String(b._id) === String(branchId));
      if (!branch) return false;
      return Boolean(branch.suspendedByLimit) || branch.isActive === false;
    },
    [branches]
  );

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
        setByBranch(res.data.byBranch || []);
        setSummary(res.data.summary || { total: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 });
      }
    } catch (err) {
      console.error(err);
      setItems([]);
      setByBranch([]);
    } finally {
      setLoading(false);
    }
  }, [branchQueryParams, statusFilter, searchTerm]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleOpenAdd = (presetBranchId = '') => {
    if (operationalBranches.length === 0) {
      alert(
        branches.some((b) => b.suspendedByLimit)
          ? 'All extra branches are suspended by plan limit. Delete a branch or ask Super Admin to increase the limit.'
          : 'Please create a branch first from the Branches page.'
      );
      return;
    }
    if (presetBranchId && isBranchStockLocked(presetBranchId)) {
      alert('This branch is suspended because it exceeds your branch limit. Kitchen stock cannot be changed.');
      return;
    }
    const defaultBranch =
      presetBranchId ||
      resolvedBranchId ||
      (operationalBranches.length === 1 ? String(operationalBranches[0]._id) : '');
    if (defaultBranch && isBranchStockLocked(defaultBranch)) {
      setModalBranchId('');
    } else {
      setModalBranchId(defaultBranch);
    }
    setEditingItem(null);
    setFormData(emptyForm);
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    if (item.suspendedByLimit || isBranchStockLocked(item.branchId)) {
      alert('This branch is suspended because it exceeds your branch limit. Kitchen stock cannot be changed.');
      return;
    }
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
    if (item.suspendedByLimit || isBranchStockLocked(item.branchId)) {
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

  const pageTitle = branchMode
    ? `Kitchen Stock — ${user?.branchName || 'Branch'}`
    : selectedBranch
      ? `Kitchen Stock — ${selectedBranch.branchName}`
      : 'Kitchen Stock — All Branches';

  const renderItemRows = (list) =>
    list.map((item) => {
      const statusMeta = STATUS_LABELS[item.stockStatus] || STATUS_LABELS.in_stock;
      const StatusIcon = statusMeta.icon;
      const locked = Boolean(item.suspendedByLimit) || isBranchStockLocked(item.branchId);
      return (
        <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9', opacity: locked ? 0.65 : 1 }}>
          <td style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontWeight: '700' }}>{item.itemName}</div>
            <div style={{ fontSize: '0.75rem', color: locked ? '#b45309' : 'var(--text-muted)' }}>
              {locked ? 'Suspended branch — stock locked' : 'Kitchen Stock'}
            </div>
          </td>
          {!showGroupedByBranch && isAllBranches && (
            <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
              {item.branchName || getBranchName(item.branchId)}
            </td>
          )}
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
                title={locked ? 'Branch suspended' : 'Reduce stock'}
                disabled={locked || actionLoading === item._id}
                onClick={() => handleAdjust(item, -1)}
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                title={locked ? 'Branch suspended' : 'Add stock'}
                disabled={locked || actionLoading === item._id}
                onClick={() => handleAdjust(item, 1)}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={locked}
                title={locked ? 'Branch suspended' : 'Edit'}
                onClick={() => handleOpenEdit(item)}
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDelete(item)}
                style={{ color: 'var(--danger)' }}
                title="Remove stock item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </td>
        </tr>
      );
    });

  const renderTable = (list, colSpan) => (
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
            {!showGroupedByBranch && isAllBranches && (
              <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>BRANCH</th>
            )}
            <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>QUANTITY LEFT</th>
            <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>LOW ALERT</th>
            <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>STATUS</th>
            <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colSpan} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading inventory...
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={colSpan} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No kitchen stock yet. Use &quot;Add Stock Item&quot; to add items like salt, pepper, or ghee.
              </td>
            </tr>
          ) : (
            renderItemRows(list)
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title={pageTitle} />
        <div className="admin-content">
          <div className="admin-action-bar" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '720px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                {branchMode
                  ? 'Manage kitchen stock for your branch — salt, oil, ghee, and similar items.'
                  : 'View and manage kitchen stock for every branch. Each branch has its own inventory record.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" onClick={fetchInventory} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleOpenAdd()}
                className="btn btn-primary btn-sm"
                disabled={
                  (!branchMode && selectedBranch && isBranchStockLocked(selectedBranch._id)) ||
                  operationalBranches.length === 0
                }
                title={
                  operationalBranches.length === 0
                    ? 'No active branches within plan limit'
                    : selectedBranch && isBranchStockLocked(selectedBranch._id)
                      ? 'Selected branch is suspended'
                      : undefined
                }
              >
                <Plus size={16} />
                Add Stock Item
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}
          >
            <div className="admin-panel admin-panel--padded" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Total Items</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{summary.total}</div>
              </div>
              <Package size={22} color="var(--secondary)" />
            </div>
            <div className="admin-panel admin-panel--padded" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>In Stock</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#15803d' }}>{summary.in_stock}</div>
              </div>
              <CheckCircle2 size={22} color="#15803d" />
            </div>
            <div className="admin-panel admin-panel--padded" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Low Stock</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#b45309' }}>{summary.low_stock}</div>
              </div>
              <AlertTriangle size={22} color="#b45309" />
            </div>
            <div className="admin-panel admin-panel--padded" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Out of Stock</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#dc2626' }}>{summary.out_of_stock}</div>
              </div>
              <XCircle size={22} color="#dc2626" />
            </div>
          </div>

          {showGroupedByBranch && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--secondary)' }}>
                Stock by Branch
              </h3>
              <div className="admin-grid-cards" style={{ marginBottom: '0.5rem' }}>
                {byBranch.map((branch) => {
                  const suspended = Boolean(branch.suspendedByLimit) || branch.branchActive === false;
                  return (
                  <button
                    key={String(branch.branchId)}
                    type="button"
                    onClick={() => setSelectedBranchId(String(branch.branchId))}
                    className="admin-panel admin-panel--padded"
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${suspended ? '#fecaca' : 'var(--border)'}`,
                      cursor: 'pointer',
                      width: '100%',
                      opacity: suspended ? 0.75 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <MapPin size={16} color={suspended ? '#b45309' : 'var(--primary)'} />
                      <strong style={{ fontSize: '0.95rem' }}>{branch.branchName}</strong>
                      {suspended && (
                        <span className="badge badge-cancelled" style={{ fontSize: '0.65rem' }}>Suspended</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.8rem' }}>
                      <div>
                        Items: <strong>{branch.total}</strong>
                      </div>
                      <div style={{ color: '#15803d' }}>
                        In stock: <strong>{branch.in_stock}</strong>
                      </div>
                      <div style={{ color: '#b45309' }}>
                        Low: <strong>{branch.low_stock}</strong>
                      </div>
                      <div style={{ color: '#dc2626' }}>
                        Out: <strong>{branch.out_of_stock}</strong>
                      </div>
                    </div>
                    {suspended && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>
                        Over branch limit — stock locked
                      </div>
                    )}
                  </button>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Click a branch card to filter that branch only, or keep &quot;All Branches&quot; selected to see the full record below.
              </p>
            </div>
          )}

          <div className="admin-panel" style={{ marginBottom: showGroupedByBranch ? '1rem' : 0 }}>
            <div className="admin-panel--padded admin-toolbar" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="admin-toolbar-search">
                <Search
                  size={18}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
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

            {!showGroupedByBranch &&
              renderTable(items, isAllBranches && !showGroupedByBranch ? 6 : 5)}
          </div>

          {showGroupedByBranch &&
            (loading ? (
              <div className="admin-panel admin-panel--padded" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading inventory...
              </div>
            ) : (
              byBranch.map((branch) => {
                const suspended = Boolean(branch.suspendedByLimit) || branch.branchActive === false;
                return (
                <div key={String(branch.branchId)} className="admin-panel" style={{ marginBottom: '1rem', opacity: suspended ? 0.8 : 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid var(--border)',
                      background: suspended ? '#fef2f2' : '#fff7ed'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MapPin size={18} color={suspended ? '#b45309' : 'var(--primary)'} />
                      <div>
                        <div style={{ fontWeight: '800', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {branch.branchName}
                          {suspended && <span className="badge badge-cancelled">Suspended (limit)</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {branch.total} item{branch.total === 1 ? '' : 's'} · Low {branch.low_stock} · Out {branch.out_of_stock}
                          {suspended ? ' · Stock locked' : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={suspended}
                      title={suspended ? 'Suspended branch — stock locked' : undefined}
                      onClick={() => handleOpenAdd(String(branch.branchId))}
                    >
                      <Plus size={14} />
                      Add to {branch.branchName}
                    </button>
                  </div>
                  {branch.items?.length
                    ? renderTable(branch.items, 5)
                    : (
                      <div style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {suspended
                          ? 'This branch exceeds your plan limit. Delete it or ask Super Admin to raise the limit.'
                          : 'No stock items in this branch yet.'}
                      </div>
                    )}
                </div>
                );
              })
            ))}
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
              {!editingItem && !branchMode && branches.length > 1 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                    Branch *
                  </label>
                  <select
                    required
                    value={modalBranchId}
                    onChange={(e) => setModalBranchId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option
                        key={branch._id}
                        value={branch._id}
                        disabled={branch.isActive === false || branch.suspendedByLimit}
                      >
                        {branch.branchName}
                        {branch.isDefault ? ' (Default)' : ''}
                        {branch.suspendedByLimit
                          ? ' — Suspended (limit)'
                          : branch.isActive === false
                            ? ' — Inactive'
                            : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!editingItem && (branchMode || branches.length === 1) && (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    padding: '0.5rem 0.75rem',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}
                >
                  Branch:{' '}
                  <strong>
                    {branchMode
                      ? user?.branchName || 'Your Branch'
                      : branches[0]?.branchName}
                  </strong>
                </div>
              )}

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
