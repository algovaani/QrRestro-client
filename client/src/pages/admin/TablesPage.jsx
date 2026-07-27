import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { getCustomerMenuPath } from '../../context/CartContext';
import {
  Plus,
  Search,
  Download,
  Printer,
  ExternalLink,
  RefreshCw,
  Edit2,
  Trash2,
  MapPin,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2
} from 'lucide-react';

export default function TablesPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    branches,
    setSelectedBranchId,
    getBranchName,
    hasMultipleBranches,
    isBranchLocked
  } = useBranch();

  const [tablesBranchId, setTablesBranchId] = useState(null);
  const [branchTables, setBranchTables] = useState([]);
  const [pickerGroups, setPickerGroups] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [formData, setFormData] = useState({
    tableName: '',
    tableNumber: '',
    section: 'Main Hall',
    capacity: 4,
    status: 'Active',
    branchId: ''
  });
  const [modalError, setModalError] = useState('');
  const [previewTable, setPreviewTable] = useState(null);

  const showBranchPicker = hasMultipleBranches && !isBranchLocked && !tablesBranchId;
  const selectedBranchName = tablesBranchId ? getBranchName(tablesBranchId) : '';

  const selectedBranchMeta = useMemo(
    () => branches.find((b) => String(b._id) === String(tablesBranchId)) || null,
    [branches, tablesBranchId]
  );
  const branchLocked = Boolean(
    selectedBranchMeta?.suspendedByLimit || selectedBranchMeta?.isActive === false
  );

  useEffect(() => {
    const fromUrl = searchParams.get('branchId');
    if (fromUrl) {
      setTablesBranchId(String(fromUrl));
      setSelectedBranchId(String(fromUrl));
      return;
    }

    if (isBranchLocked && user?.branchId) {
      setTablesBranchId(String(user.branchId));
      return;
    }

    if (!hasMultipleBranches && branches.length === 1) {
      setTablesBranchId(String(branches[0]._id));
      return;
    }

    if (hasMultipleBranches && !isBranchLocked) {
      setTablesBranchId(null);
      setSelectedBranchId('all');
      setBranchTables([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (searchParams.get('branchId')) return;
    if (isBranchLocked && user?.branchId) {
      setTablesBranchId(String(user.branchId));
      return;
    }
    if (!hasMultipleBranches && branches.length === 1 && !tablesBranchId) {
      setTablesBranchId(String(branches[0]._id));
    }
  }, [isBranchLocked, hasMultipleBranches, branches, user?.branchId, searchParams, tablesBranchId]);

  const isStaleQr = (table) => {
    if (!table?.qrUrl) return true;
    if (!table.qrUrl.includes('/branch/')) return true;
    return /localhost|127\.0\.0\.1|:5000\//.test(table.qrUrl);
  };

  useEffect(() => {
    if (!showBranchPicker) return;
    setPickerLoading(true);
    API.get('/tables')
      .then((res) => {
        if (!res.data.success) return;
        const allTables = res.data.tables || [];
        const groups = (branches.length ? branches : []).map((branch) => {
          const branchTables = allTables.filter((t) => String(t.branchId) === String(branch._id));
          const activeCount = branchTables.filter((t) => t.status === 'Active').length;
          const staleCount = branchTables.filter(isStaleQr).length;
          return {
            branchId: String(branch._id),
            branchName: branch.branchName,
            suspendedByLimit: Boolean(branch.suspendedByLimit),
            isActive: branch.isActive !== false,
            total: branchTables.length,
            active: activeCount,
            inactive: branchTables.length - activeCount,
            staleQr: staleCount
          };
        });
        setPickerGroups(groups);
      })
      .catch(console.error)
      .finally(() => setPickerLoading(false));
  }, [showBranchPicker, user?._id, branches]);

  const fetchTables = useCallback(async () => {
    if (!tablesBranchId) {
      setBranchTables([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await API.get('/tables', {
        params: { branchId: tablesBranchId }
      });
      if (res.data.success) {
        setBranchTables(res.data.tables || []);
      }
    } catch (err) {
      console.error('Error fetching tables:', err);
      setBranchTables([]);
    } finally {
      setLoading(false);
    }
  }, [tablesBranchId]);

  const tables = useMemo(() => {
    let list = branchTables;
    if (statusFilter) {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          String(t.tableName || '').toLowerCase().includes(q) ||
          String(t.tableNumber || '').toLowerCase().includes(q) ||
          String(t.section || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [branchTables, statusFilter, search]);

  useEffect(() => {
    if (showBranchPicker) return;
    fetchTables();
  }, [fetchTables, showBranchPicker]);

  const handleSelectBranch = (branchId) => {
    setTablesBranchId(String(branchId));
    setSelectedBranchId(String(branchId));
    setSearch('');
    setStatusFilter('');
  };

  const handleChangeBranch = () => {
    setTablesBranchId(null);
    setSelectedBranchId('all');
    setBranchTables([]);
    setSearch('');
    setStatusFilter('');
  };

  const handleOpenAdd = () => {
    if (!tablesBranchId) {
      alert('Please select a branch first.');
      return;
    }
    if (branchLocked) {
      alert('This branch is suspended because it exceeds your branch limit. Tables cannot be added.');
      return;
    }
    setEditingTable(null);
    const nextNum = (branchTables.length + 1).toString();
    setFormData({
      tableName: `Table ${nextNum}`,
      tableNumber: nextNum,
      section: 'Main Hall',
      capacity: 4,
      status: 'Active',
      branchId: tablesBranchId
    });
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (table) => {
    if (branchLocked) {
      alert('This branch is suspended. Tables cannot be edited.');
      return;
    }
    setEditingTable(table);
    setFormData({
      tableName: table.tableName,
      tableNumber: table.tableNumber,
      section: table.section || 'Main Hall',
      capacity: table.capacity || 4,
      status: table.status,
      branchId: table.branchId || tablesBranchId
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    const payload = { ...formData, branchId: formData.branchId || tablesBranchId };
    if (!editingTable && !payload.branchId) {
      setModalError('Please select a branch first.');
      return;
    }
    try {
      if (editingTable) {
        await API.put(`/tables/${editingTable._id}`, payload);
      } else {
        await API.post('/tables', payload);
      }
      setShowModal(false);
      fetchTables();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error saving table');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    try {
      await API.delete(`/tables/${id}`);
      fetchTables();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting table');
    }
  };

  const handleRegenerateQR = async (id) => {
    if (branchLocked) {
      alert('This branch is suspended. QR codes cannot be regenerated.');
      return;
    }
    try {
      await API.post(`/tables/${id}/regenerate-qr`);
      fetchTables();
      alert('QR Code regenerated successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Error regenerating QR Code');
    }
  };

  const handleRegenerateAllQR = async () => {
    if (branchLocked) {
      alert('This branch is suspended. QR codes cannot be regenerated.');
      return;
    }
    if (!window.confirm('Regenerate all QR codes for this branch with the current network URL? You must download/print the new codes after this.')) return;
    try {
      const res = await API.post('/tables/regenerate-all-qrs', null, {
        params: tablesBranchId ? { branchId: tablesBranchId } : {}
      });
      fetchTables();
      alert(res.data?.message || 'All QR codes regenerated');
    } catch (err) {
      alert(err.response?.data?.message || 'Error regenerating QR codes');
    }
  };

  const hasStaleQrCodes = branchTables.some(isStaleQr);
  const activeCount = branchTables.filter((t) => t.status === 'Active').length;

  const downloadQR = (table) => {
    const qrSrc = table.qrCodeImage || table.qrCode;
    if (!qrSrc) return alert('No QR Code available for download.');
    const link = document.createElement('a');
    link.href = qrSrc;
    link.download = `Table-${table.tableNumber}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printQRCard = (table) => {
    const qrSrc = table.qrCodeImage || table.qrCode;
    const branchLabel = getBranchName(table.branchId);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR - Table ${table.tableNumber}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; }
            .card { border: 2px solid #0f172a; padding: 30px; border-radius: 20px; display: inline-block; }
            h1 { font-size: 28px; margin-bottom: 5px; }
            p { font-size: 16px; color: #64748b; margin-bottom: 20px; }
            img { width: 250px; height: 250px; }
            .footer { margin-top: 15px; font-weight: bold; color: #ff6b00; }
            .branch { font-size: 14px; color: #334155; margin-bottom: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            ${branchLabel ? `<div class="branch">${branchLabel}</div>` : ''}
            <h1>${table.tableName}</h1>
            <p>Scan QR Code to View Digital Menu & Order</p>
            <img src="${qrSrc}" />
            <div class="footer">Table Number: ${table.tableNumber}</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderTableCard = (table) => {
    const qrSrc = table.qrCodeImage || table.qrCode;

    return (
      <div
        key={table._id}
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)',
          opacity: branchLocked ? 0.75 : 1
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--secondary)' }}>{table.tableName}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {table.section} • {table.capacity} Seats
              </span>
            </div>
            <span className={`badge ${table.status === 'Active' ? 'badge-completed' : 'badge-cancelled'}`}>
              {table.status}
            </span>
          </div>

          <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '10px', margin: '0.5rem 0 1rem 0' }}>
            {qrSrc ? (
              <img
                src={qrSrc}
                alt={`QR Table ${table.tableNumber}`}
                style={{ width: '120px', height: '120px', objectFit: 'contain', cursor: 'pointer' }}
                onClick={() => setPreviewTable(table)}
              />
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No QR Code Generated</div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600', marginTop: '0.25rem' }}>
              Table #{table.tableNumber}
            </div>
            {isStaleQr(table) && (
              <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: '700', marginTop: '0.35rem' }}>
                Old QR — regenerate &amp; download again
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="admin-form-grid-2" style={{ gap: '0.5rem' }}>
            <button onClick={() => downloadQR(table)} className="btn btn-secondary btn-sm" title="Download QR PNG">
              <Download size={14} /> Download
            </button>
            <button onClick={() => printQRCard(table)} className="btn btn-secondary btn-sm" title="Print Table QR Standee">
              <Printer size={14} /> Print Card
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
            <a
              href={getCustomerMenuPath(table.adminId, table.tableNumber, table.branchId)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: '0.75rem' }}
            >
              <ExternalLink size={14} /> Open Menu
            </a>

            <button
              onClick={() => handleRegenerateQR(table._id)}
              className="btn btn-secondary btn-sm"
              title="Regenerate QR Code"
              disabled={branchLocked}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => handleOpenEdit(table)}
              className="btn btn-secondary btn-sm"
              title="Edit Table"
              disabled={branchLocked}
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => handleDelete(table._id)}
              className="btn btn-secondary btn-sm"
              title="Delete Table"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header
          title={showBranchPicker ? 'Select Branch' : `Tables & QR — ${selectedBranchName || user?.branchName || 'Branch'}`}
          hideBranchSelector
          branchLabel={showBranchPicker ? '' : (selectedBranchName || user?.branchName || '')}
        />
        <div className="admin-content">

          {showBranchPicker ? (
            <div>
              <div className="admin-panel admin-panel--padded" style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--secondary)' }}>
                  Select a branch to manage tables &amp; QR codes
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Tables and QR codes are shown one branch at a time. Choose the branch you want to manage.
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
                            Suspended — exceeds branch limit. Tables &amp; QR locked.
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                          <div style={{ background: '#f0fdf4', padding: '0.55rem 0.65rem', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Active</div>
                            <div style={{ fontWeight: 800, color: '#15803d' }}>{group.active} tables</div>
                          </div>
                          <div style={{ background: '#eff6ff', padding: '0.55rem 0.65rem', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Total</div>
                            <div style={{ fontWeight: 800, color: '#1d4ed8' }}>{group.total} tables</div>
                          </div>
                        </div>

                        {group.staleQr > 0 && !isSuspended && (
                          <div style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>
                            {group.staleQr} old QR code{group.staleQr === 1 ? '' : 's'} — regenerate after opening
                          </div>
                        )}

                        <span
                          className={`btn btn-sm ${isSuspended ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          {isSuspended ? 'Not Available' : 'View Tables'}
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

              {branchLocked && (
                <div className="admin-panel admin-panel--padded" style={{ marginBottom: '1rem', background: '#fef2f2', borderColor: '#fecaca' }}>
                  <p style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 700, margin: 0 }}>
                    This branch is suspended (over plan limit). Tables are view-only — delete the branch or ask Super Admin to increase limit.
                  </p>
                </div>
              )}

              {hasStaleQrCodes && !branchLocked && (
                <div className="admin-panel admin-panel--padded" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#fff7ed', borderColor: '#fed7aa' }}>
                  <AlertCircle size={20} style={{ color: '#b45309', flexShrink: 0, marginTop: '0.1rem' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.25rem', color: '#92400e' }}>
                      Old QR codes detected in this branch
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                      Regenerate all codes for <strong>{selectedBranchName}</strong>, then download or print the new QR images.
                    </p>
                    <button type="button" onClick={handleRegenerateAllQR} className="btn btn-primary btn-sm">
                      <RefreshCw size={14} /> Regenerate All QR Codes
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Tables</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{branchTables.length}</div>
                </div>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #15803d' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Active</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>{activeCount}</div>
                </div>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #b45309' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Old QR Codes</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b45309' }}>{branchTables.filter(isStaleQr).length}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '1rem', flex: 1, maxWidth: '450px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search table name or number..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: '100%', paddingLeft: '38px' }}
                    />
                  </div>

                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button onClick={fetchTables} className="btn btn-secondary btn-sm" type="button" title="Refresh">
                    <RefreshCw size={16} />
                  </button>
                  <button onClick={handleOpenAdd} className="btn btn-primary" disabled={branchLocked || !tablesBranchId}>
                    <Plus size={18} />
                    <span>Add Table</span>
                  </button>
                  <button onClick={handleRegenerateAllQR} className="btn btn-secondary" type="button" disabled={branchLocked || branchTables.length === 0}>
                    <RefreshCw size={16} />
                    <span>Regenerate All QRs</span>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="admin-panel admin-panel--padded" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  Loading tables...
                </div>
              ) : (
                <div className="admin-grid-cards">
                  {tables.map((table) => renderTableCard(table))}
                </div>
              )}

              {branchTables.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '12px', color: 'var(--text-muted)' }}>
                  No tables in {selectedBranchName || 'this branch'} yet. Click &quot;Add Table&quot; to get started.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem' }}>
              {editingTable ? 'Edit Table' : 'Add New Table'}
            </h3>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                Branch: <strong>{selectedBranchName || user?.branchName || 'Branch'}</strong> — QR code will be generated for this branch
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Table Display Name *</label>
                <input
                  type="text"
                  required
                  value={formData.tableName}
                  onChange={(e) => setFormData({ ...formData, tableName: e.target.value })}
                  placeholder="e.g. Table 1 or VIP 01"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Table Number (URL ID) *</label>
                <input
                  type="text"
                  required
                  value={formData.tableNumber}
                  onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                  placeholder="e.g. 1"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="admin-form-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Section / Floor</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="e.g. Main Hall, Terrace"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="Active">Active (Allows Ordering)</option>
                  <option value="Inactive">Inactive (Disabled)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewTable && (
        <div className="modal-overlay" onClick={() => setPreviewTable(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '380px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{previewTable.tableName}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {selectedBranchName ? `${selectedBranchName} • ` : ''}
              Scan QR Code to open digital menu for Table {previewTable.tableNumber}
            </p>

            <img
              src={previewTable.qrCodeImage || previewTable.qrCode}
              alt="Full QR"
              style={{ width: '240px', height: '240px', objectFit: 'contain', margin: '0 auto' }}
            />

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', wordBreak: 'break-all' }}>
              {previewTable.qrUrl}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button onClick={() => downloadQR(previewTable)} className="btn btn-primary">
                <Download size={16} /> Download PNG
              </button>
              <button onClick={() => printQRCard(previewTable)} className="btn btn-secondary">
                <Printer size={16} /> Print Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
