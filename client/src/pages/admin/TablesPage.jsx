import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useBranch } from '../../context/BranchContext';
import { getCustomerMenuPath } from '../../context/CartContext';
import { Plus, Search, QrCode, Download, Printer, ExternalLink, RefreshCw, Edit2, Trash2, MapPin, AlertCircle } from 'lucide-react';

export default function TablesPage() {
  const [searchParams] = useSearchParams();
  const {
    branchQueryParams,
    isAllBranches,
    branches,
    getBranchName,
    selectedBranch,
    setSelectedBranchId
  } = useBranch();
  const [tables, setTables] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State for Add/Edit
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

  // QR Preview Modal State
  const [previewTable, setPreviewTable] = useState(null);

  useEffect(() => {
    const fromUrl = searchParams.get('branchId');
    if (fromUrl) {
      setSelectedBranchId(fromUrl);
    }
  }, [searchParams, setSelectedBranchId]);

  useEffect(() => {
    fetchTables();
  }, [search, statusFilter, branchQueryParams.branchId]);

  const tablesByBranch = useMemo(() => {
    if (!isAllBranches) return null;
    const groups = {};
    for (const table of tables) {
      const key = String(table.branchId || 'unknown');
      if (!groups[key]) {
        groups[key] = {
          branchId: table.branchId,
          branchName: getBranchName(table.branchId) || 'Branch',
          tables: []
        };
      }
      groups[key].tables.push(table);
    }
    return Object.values(groups).sort((a, b) => a.branchName.localeCompare(b.branchName));
  }, [tables, isAllBranches, getBranchName]);

  const fetchTables = async () => {
    try {
      const res = await API.get('/tables', {
        params: { search, status: statusFilter, ...branchQueryParams }
      });
      if (res.data.success) {
        setTables(res.data.tables || []);
      }
    } catch (err) {
      console.error('Error fetching tables:', err);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    if (isAllBranches && branches.length > 1) {
      alert('Pehle header se ek branch select karein. Har branch ke apne alag tables & QR codes hote hain.');
      return;
    }
    setEditingTable(null);
    const nextNum = (tables.length + 1).toString();
    const defaultBranch = branches.find((b) => b.isDefault) || branches[0];
    setFormData({
      tableName: `Table ${nextNum}`,
      tableNumber: nextNum,
      section: 'Main Hall',
      capacity: 4,
      status: 'Active',
      branchId: branchQueryParams.branchId || defaultBranch?._id || ''
    });
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (table) => {
    setEditingTable(table);
    setFormData({
      tableName: table.tableName,
      tableNumber: table.tableNumber,
      section: table.section || 'Main Hall',
      capacity: table.capacity || 4,
      status: table.status,
      branchId: table.branchId || ''
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    const payload = { ...formData };
    if (!editingTable && !payload.branchId && branchQueryParams.branchId) {
      payload.branchId = branchQueryParams.branchId;
    }
    if (!editingTable && !payload.branchId && branches.length === 1) {
      payload.branchId = branches[0]._id;
    }
    if (!editingTable && !payload.branchId) {
      setModalError('Branch select karein — har table ek specific branch se judi hoti hai.');
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
    try {
      await API.post(`/tables/${id}/regenerate-qr`);
      fetchTables();
      alert('QR Code regenerated successfully');
    } catch (err) {
      alert('Error regenerating QR Code');
    }
  };

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
    const branchLabel = getBranchName(table.branchId);

    return (
      <div key={table._id} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--secondary)' }}>{table.tableName}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isAllBranches && branchLabel ? (
                  <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{branchLabel} • </span>
                ) : null}
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
            {branchLabel && !isAllBranches && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {branchLabel}
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

            <button onClick={() => handleRegenerateQR(table._id)} className="btn btn-secondary btn-sm" title="Regenerate QR Code">
              <RefreshCw size={14} />
            </button>
            <button onClick={() => handleOpenEdit(table)} className="btn btn-secondary btn-sm" title="Edit Table">
              <Edit2 size={14} />
            </button>
            <button onClick={() => handleDelete(table._id)} className="btn btn-secondary btn-sm" title="Delete Table" style={{ color: 'var(--danger)' }}>
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
        <Header title={selectedBranch ? `Tables & QR — ${selectedBranch.branchName}` : 'Tables & QR Codes'} />
        <div className="admin-content">

          {isAllBranches && branches.length > 1 && (
            <div className="admin-panel admin-panel--padded" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#fff7ed', borderColor: '#fed7aa' }}>
              <AlertCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  Har branch ke alag Tables & QR Codes
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Nayi table ya QR banane ke liye header se branch select karein, ya <strong>Branches</strong> page se &quot;Manage Tables & QR&quot; par click karein.
                </p>
              </div>
            </div>
          )}

          {!isAllBranches && selectedBranch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <MapPin size={15} style={{ color: 'var(--primary)' }} />
              <span>Managing tables for: <strong style={{ color: 'var(--secondary)' }}>{selectedBranch.branchName}</strong> — is branch ke apne QR codes</span>
            </div>
          )}
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

            <button onClick={handleOpenAdd} className="btn btn-primary">
              <Plus size={18} />
              <span>Add Table</span>
            </button>
          </div>

          {/* Table Grid Cards */}
          {isAllBranches && tablesByBranch && tablesByBranch.length > 0 ? (
            tablesByBranch.map((group) => (
              <div key={group.branchId} style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={16} style={{ color: 'var(--primary)' }} />
                  {group.branchName}
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>({group.tables.length} tables)</span>
                </h3>
                <div className="admin-grid-cards">
                  {group.tables.map((table) => renderTableCard(table))}
                </div>
              </div>
            ))
          ) : (
            <div className="admin-grid-cards">
              {tables.map((table) => renderTableCard(table))}
            </div>
          )}

          {tables.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '12px', color: 'var(--text-muted)' }}>
              {isAllBranches && branches.length > 1
                ? 'Koi table nahi mili. Branch select karke nayi table add karein.'
                : 'Is branch mein abhi koi table nahi. "+ Add Table" se shuru karein.'}
            </div>
          )}

        </div>
      </div>

      {/* Add / Edit Table Modal */}
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
              {!editingTable && isAllBranches && branches.length > 1 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                  Branch select karein header se, phir table add karein.
                </div>
              )}

              {!editingTable && !isAllBranches && selectedBranch && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  Branch: <strong>{selectedBranch.branchName}</strong> — QR is branch ke liye generate hoga
                </div>
              )}

              {!editingTable && isAllBranches && branches.length === 1 && branches[0] && (
                <input type="hidden" value={formData.branchId || branches[0]._id} readOnly />
              )}

              {editingTable && editingTable.branchId && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Branch: <strong>{getBranchName(editingTable.branchId)}</strong>
                </div>
              )}

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

      {/* QR Code Full Modal Preview */}
      {previewTable && (
        <div className="modal-overlay" onClick={() => setPreviewTable(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '380px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{previewTable.tableName}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {getBranchName(previewTable.branchId) ? `${getBranchName(previewTable.branchId)} • ` : ''}
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
