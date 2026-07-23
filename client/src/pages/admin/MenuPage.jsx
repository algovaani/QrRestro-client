import React, { useState, useEffect, useMemo } from 'react';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Plus, Search, Edit2, Trash2, Star, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { resolveUploadUrl } from '../../utils/uploadUrl';

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [foodTypeFilter, setFoodTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // DATATABLE STATES
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    foodType: 'Veg',
    priceType: 'Single Fixed Price',
    halfPrice: 0,
    fullPrice: 0,
    fixedPrice: 0,
    preparationTime: 15,
    isAvailable: true,
    isFeatured: false,
    status: 'Active'
  });
  const [imageFile, setImageFile] = useState(null);
  const [existingImage, setExistingImage] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchMenuItems();
  }, [categoryFilter, foodTypeFilter]);

  const fetchCategories = async () => {
    try {
      const res = await API.get('/categories');
      if (res.data.success) setCategories(res.data.categories || []);
    } catch (err) {
      console.error(err);
      setCategories([]);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const res = await API.get('/menu', {
        params: { category: categoryFilter, foodType: foodTypeFilter }
      });
      if (res.data.success) {
        setMenuItems(res.data.items || res.data.menuItems || []);
      }
    } catch (err) {
      console.error(err);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  // DATATABLE FILTERING, SORTING & PAGINATION LOGIC
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredMenuItems = useMemo(() => {
    const safeItems = Array.isArray(menuItems) ? menuItems : [];
    return safeItems.filter(item => {
      const query = (searchTerm || '').toLowerCase();
      const catName = item.category?.name || '';
      return (
        item.name?.toLowerCase().includes(query) ||
        catName.toLowerCase().includes(query) ||
        item.foodType?.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
    });
  }, [menuItems, searchTerm]);

  const sortedMenuItems = useMemo(() => {
    return [...filteredMenuItems].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'category') {
        aVal = a.category?.name || '';
        bVal = b.category?.name || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredMenuItems, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedMenuItems.length / itemsPerPage) || 1;
  const paginatedMenuItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedMenuItems.slice(start, start + itemsPerPage);
  }, [sortedMenuItems, currentPage, itemsPerPage]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: categories.length > 0 ? categories[0]._id : '',
      description: '',
      foodType: 'Veg',
      priceType: 'Single Fixed Price',
      halfPrice: 0,
      fullPrice: 0,
      fixedPrice: 150,
      preparationTime: 15,
      isAvailable: true,
      isFeatured: false,
      status: 'Active'
    });
    setImageFile(null);
    setExistingImage('');
    setPreviewImage('');
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category?._id || item.category,
      description: item.description || '',
      foodType: item.foodType || 'Veg',
      priceType: item.priceType || 'Single Fixed Price',
      halfPrice: item.halfPrice || 0,
      fullPrice: item.fullPrice || 0,
      fixedPrice: item.fixedPrice || 0,
      preparationTime: item.preparationTime || 15,
      isAvailable: item.isAvailable,
      isFeatured: item.isFeatured,
      status: item.status
    });
    setImageFile(null);
    setExistingImage(item.image || '');
    setPreviewImage(item.image ? getItemImageSrc(item) : '');
    setModalError('');
    setShowModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setModalError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setModalError('Image must be 3MB or smaller.');
      return;
    }
    setModalError('');
    setImageFile(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const getItemImageSrc = (item) => {
    if (!item?.image) return null;
    const base = resolveUploadUrl(item.image);
    if (!base) return null;
    const version = item.updatedAt ? new Date(item.updatedAt).getTime() : '';
    if (!version) return base;
    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}v=${version}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key]);
    });
    if (imageFile) {
      data.append('image', imageFile);
    } else if (editingItem && existingImage) {
      data.append('keepExistingImage', 'true');
    }

    try {
      const res = editingItem
        ? await API.put(`/menu/${editingItem._id}`, data)
        : await API.post('/menu', data);

      const saved = res.data?.item;
      if (imageFile && saved && !saved.image) {
        setModalError('Image upload failed — please try again with a JPG/PNG under 3MB.');
        return;
      }

      setShowModal(false);
      setImageFile(null);
      setExistingImage('');
      setPreviewImage('');
      fetchMenuItems();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error saving menu item');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await API.delete(`/menu/${id}`);
      fetchMenuItems();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting item');
    }
  };

  const toggleAvailability = async (id) => {
    try {
      await API.patch(`/menu/${id}/availability`);
      fetchMenuItems();
    } catch (err) {
      alert('Error updating availability');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Menu Items Datatable" />
        <div className="admin-content">

          {/* DATATABLE TOP CONTROLS */}
          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              
              {/* Live Search */}
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }} className="admin-toolbar-search">
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Live search item name, category..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ width: '100%', paddingLeft: '38px' }}
                />
              </div>

              {/* Filters & Rows Dropdown */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>

                <select value={foodTypeFilter} onChange={(e) => setFoodTypeFilter(e.target.value)}>
                  <option value="">All Dietary Types</option>
                  <option value="Veg">Veg</option>
                  <option value="Non-Veg">Non-Veg</option>
                  <option value="Jain">Jain</option>
                  <option value="Vegan">Vegan</option>
                </select>

                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5 rows per page</option>
                  <option value={10}>10 rows per page</option>
                  <option value={25}>25 rows per page</option>
                  <option value={50}>50 rows per page</option>
                </select>

                <button onClick={handleOpenAdd} className="btn btn-primary">
                  <Plus size={18} />
                  <span>Add Menu Item</span>
                </button>
              </div>

            </div>
          </div>

          {/* DATATABLE BODY */}
          <div className="admin-panel">
            <div className="admin-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <tr>
                  <th onClick={() => handleSort('name')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      ITEM <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('category')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      CATEGORY <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('foodType')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      FOOD TYPE <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '0.8rem 1rem' }}>PRICING</th>
                  <th onClick={() => handleSort('isAvailable')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      AVAILABILITY <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMenuItems.map((item) => (
                  <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {item.image ? (
                          <img
                            src={getItemImageSrc(item)}
                            alt={item.name}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                            🍲
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {item.name}
                            {item.isFeatured && <Star size={14} color="#f59e0b" fill="#f59e0b" />}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Prep time: {item.preparationTime} mins
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                      {item.category?.name || 'Uncategorized'}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={`badge ${item.foodType === 'Veg' ? 'badge-veg' : item.foodType === 'Non-Veg' ? 'badge-nonveg' : 'badge-jain'}`}>
                        {item.foodType}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontWeight: '600' }}>
                      {item.priceType === 'Full and Half' && (
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Half:</span> ₹{item.halfPrice} | <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full:</span> ₹{item.fullPrice}
                        </div>
                      )}
                      {item.priceType === 'Only Half' && <div>Half: ₹{item.halfPrice}</div>}
                      {item.priceType === 'Only Full' && <div>Full: ₹{item.fullPrice}</div>}
                      {item.priceType === 'Single Fixed Price' && <div>Fixed: ₹{item.fixedPrice}</div>}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <button
                        onClick={() => toggleAvailability(item._id)}
                        className={`badge ${item.isAvailable ? 'badge-completed' : 'badge-cancelled'}`}
                        style={{ cursor: 'pointer' }}
                      >
                        {item.isAvailable ? 'Available' : 'Unavailable'}
                      </button>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button onClick={() => handleOpenEdit(item)} className="btn btn-secondary btn-sm" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(item._id)} className="btn btn-danger btn-sm" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedMenuItems.length === 0 && !loading && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No menu items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {/* DATATABLE FOOTER PAGINATION */}
            <div className="admin-datatable-footer">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing {sortedMenuItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, sortedMenuItems.length)} of {sortedMenuItems.length} entries
              </div>

              <div className="admin-datatable-pagination">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  <ChevronLeft size={14} />
                </button>

                <span style={{ fontSize: '0.85rem', fontWeight: '700', padding: '0 0.5rem' }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem 0.5rem' }}
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Add / Edit Menu Item Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem' }}>
              {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h3>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="admin-form-grid-split">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Item Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Paneer Butter Masala"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Description</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ingredients and taste notes..."
                  style={{ width: '100%' }}
                />
              </div>

              <div className="admin-form-grid-3">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Food Type</label>
                  <select
                    value={formData.foodType}
                    onChange={(e) => setFormData({ ...formData, foodType: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Jain">Jain</option>
                    <option value="Vegan">Vegan</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Price Structure</label>
                  <select
                    value={formData.priceType}
                    onChange={(e) => setFormData({ ...formData, priceType: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="Single Fixed Price">Single Fixed Price</option>
                    <option value="Full and Half">Full and Half</option>
                    <option value="Only Full">Only Full</option>
                    <option value="Only Half">Only Half</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Prep Time (mins)</label>
                  <input
                    type="number"
                    value={formData.preparationTime}
                    onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Dynamic Price Inputs */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', display: 'flex', gap: '1rem' }}>
                {formData.priceType === 'Single Fixed Price' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Fixed Price (₹)</label>
                    <input
                      type="number"
                      value={formData.fixedPrice}
                      onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {(formData.priceType === 'Full and Half' || formData.priceType === 'Only Half') && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Half Price (₹)</label>
                    <input
                      type="number"
                      value={formData.halfPrice}
                      onChange={(e) => setFormData({ ...formData, halfPrice: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {(formData.priceType === 'Full and Half' || formData.priceType === 'Only Full') && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Full Price (₹)</label>
                    <input
                      type="number"
                      value={formData.fullPrice}
                      onChange={(e) => setFormData({ ...formData, fullPrice: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  />
                  Item Available for Ordering
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                  />
                  Featured Chef Special
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Item Image</label>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageChange} style={{ width: '100%' }} />
                {previewImage && (
                  <img
                    src={previewImage}
                    alt="Preview"
                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', marginTop: '0.5rem', display: 'block' }}
                  />
                )}
                {!previewImage && existingImage && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Current image saved — pick a new file to replace it.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
