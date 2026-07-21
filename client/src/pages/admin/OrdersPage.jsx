import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useSocket } from '../../context/SocketContext';
import { prependUniqueOrder, upsertOrder } from '../../utils/orderList';
import { useLivePolling } from '../../hooks/useLivePolling';
import { useAuth } from '../../context/AuthContext';
import { sendOrderBillOnWhatsApp } from '../../utils/billShare';
import { Printer, Eye, RefreshCw, MessageSquare, Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function OrdersPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialStatusFromUrl = searchParams.get('status') || '';

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState(initialStatusFromUrl);
  const [paymentFilter, setPaymentFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // DATATABLE STATES
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selected Order Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Payment confirm dialog (Paid / Unpaid toggle)
  const [paymentConfirm, setPaymentConfirm] = useState(null);

  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const [billSendingId, setBillSendingId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, paymentFilter]);

  // Refetch orders when socket reconnects (catch missed events during disconnect)
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReconnect = () => {
      fetchOrders();
    };

    socket.on('connect', handleReconnect);
    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [socket, isConnected]);

  // Handle URL change if navigated from Dashboard
  useEffect(() => {
    const statusParam = searchParams.get('status') || '';
    if (statusParam !== statusFilter) {
      setStatusFilter(statusParam);
    }
  }, [location.search]);

  // Real-time WebSocket handlers - HAND TO HAND SOCKET PROCESS
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      setOrders((prev) => prependUniqueOrder(prev, newOrder));
    };

    const handleStatusUpdate = (updatedOrder) => {
      setOrders((prev) => upsertOrder(prev, updatedOrder));
      if (selectedOrder && selectedOrder._id === updatedOrder._id) {
        setSelectedOrder(updatedOrder);
      }
    };

    const handlePaymentPending = (updatedOrder) => {
      setOrders((prev) => upsertOrder(prev, updatedOrder));
      if (selectedOrder && selectedOrder._id === updatedOrder._id) {
        setSelectedOrder(updatedOrder);
      }
    };

    const handlePaymentSuccess = (updatedOrder) => {
      setOrders((prev) => upsertOrder(prev, updatedOrder));
      if (selectedOrder && selectedOrder._id === updatedOrder._id) {
        setSelectedOrder(updatedOrder);
      }
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_update', handleStatusUpdate);
    socket.on('payment_pending', handlePaymentPending);
    socket.on('payment_success', handlePaymentSuccess);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_update', handleStatusUpdate);
      socket.off('payment_pending', handlePaymentPending);
      socket.off('payment_success', handlePaymentSuccess);
    };
  }, [socket, selectedOrder]);

  const fetchOrders = async () => {
    try {
      const res = await API.get('/orders', {
        params: { status: statusFilter, paymentStatus: paymentFilter }
      });
      if (res.data.success) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useLivePolling(fetchOrders, 15000, true);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const res = await API.patch(`/orders/${orderId}/status`, { orderStatus: newStatus });
      if (res.data.success) {
        setOrders(prev => prev.map(o => o._id === orderId ? res.data.order : o));
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(res.data.order);
        }
      }
    } catch (err) {
      alert('Failed to update order status');
    }
  };

  const approvePayment = async (orderId) => {
    try {
      const res = await API.post(`/payment/approve/${orderId}`);
      if (res.data.success) {
        const order = res.data.order;
        setOrders((prev) => prev.map((o) => (o._id === orderId ? order : o)));
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(order);
        }

        if (order?.customerMobile && window.confirm('Payment approved! Send PDF bill to customer on WhatsApp?')) {
          try {
            const result = await sendOrderBillOnWhatsApp(order, {
              restaurantName: user?.restaurantName || res.data.bill?.restaurantName || 'Royal Spice Restaurant',
              taxLabel: res.data.bill?.taxLabel || 'GST Tax'
            });
            if (result.hint) {
              alert(result.hint);
            }
          } catch {
            alert('Could not generate PDF bill. Try again from the Orders page.');
          }
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve payment');
    }
  };

  const rejectPayment = async (orderId) => {
    if (!window.confirm('Reject this payment? Customer will need to pay again.')) return;
    try {
      const res = await API.post(`/payment/reject/${orderId}`);
      if (res.data.success) {
        setOrders((prev) => prev.map((o) => (o._id === orderId ? res.data.order : o)));
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(res.data.order);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject payment');
    }
  };

  const updatePayment = async (orderId, paymentStatus, paymentMethod = 'UPI') => {
    try {
      const res = await API.patch(`/orders/${orderId}/payment`, { paymentStatus, paymentMethod });
      if (res.data.success) {
        setOrders(prev => prev.map(o => o._id === orderId ? res.data.order : o));
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(res.data.order);
        }
      }
    } catch (err) {
      alert('Failed to update payment status');
    }
  };

  const openPaymentConfirm = (order) => {
    const newStatus = order.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    setPaymentConfirm({ order, newStatus });
  };

  const handlePaymentConfirmYes = async () => {
    if (!paymentConfirm) return;
    const { order, newStatus } = paymentConfirm;
    setPaymentConfirm(null);
    await updatePayment(order._id, newStatus);
  };

  const handlePaymentConfirmNo = () => {
    setPaymentConfirm(null);
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

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const query = searchTerm.toLowerCase();
      return (
        order.orderNumber.toLowerCase().includes(query) ||
        `table ${order.tableNumber}`.toLowerCase().includes(query) ||
        order.tableNumber.toString().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        (order.customerMobile && order.customerMobile.includes(query)) ||
        order.orderStatus.toLowerCase().includes(query) ||
        order.paymentStatus.toLowerCase().includes(query) ||
        (order.transactionId && order.transactionId.toLowerCase().includes(query))
      );
    });
  }, [orders, searchTerm]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'tableNumber') {
        aVal = parseInt(a.tableNumber) || 0;
        bVal = parseInt(b.tableNumber) || 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedOrders.slice(start, start + itemsPerPage);
  }, [sortedOrders, currentPage, itemsPerPage]);

  const sendWhatsAppBill = async (order) => {
    if (!order?.customerMobile) {
      alert('Customer mobile number is missing — cannot send bill on WhatsApp.');
      return;
    }

    setBillSendingId(order._id);
    try {
      const result = await sendOrderBillOnWhatsApp(order, {
        restaurantName: user?.restaurantName || 'Royal Spice Restaurant'
      });
      if (result.cancelled) return;
      if (result.hint) {
        alert(result.hint);
      }
    } catch {
      alert('Could not generate or share bill PDF. Please try again.');
    } finally {
      setBillSendingId(null);
    }
  };

  const handlePrint = (order, type) => {
    const printWindow = window.open('', '_blank');
    const isKitchen = type === 'kitchen';

    printWindow.document.write(`
      <html>
        <head>
          <title>${isKitchen ? 'KITCHEN TICKET' : 'CUSTOMER BILL'} - ${order.orderNumber}</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; font-size: 13px; }
            h2, h3 { text-align: center; margin: 5px 0; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .flex { display: flex; justify-content: space-between; margin: 4px 0; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>ROYAL SPICE</h2>
          <h3>${isKitchen ? '*** KITCHEN ORDER TICKET ***' : 'TAX INVOICE'}</h3>
          <div class="divider"></div>
          <div>Order #: <strong>${order.orderNumber}</strong></div>
          <div>Table #: <strong>Table ${order.tableNumber}</strong></div>
          <div>Date: ${new Date(order.createdAt).toLocaleString()}</div>
          ${!isKitchen ? `<div>Customer: ${order.customerName} (${order.customerMobile || 'N/A'})</div>` : ''}
          <div class="divider"></div>

          ${order.items.map(item => `
            <div class="flex bold">
              <span>${item.itemName} (${item.size}) x ${item.quantity}</span>
              ${!isKitchen ? `<span>₹${item.total}</span>` : ''}
            </div>
            ${item.instructions ? `<div style="font-size:11px; font-style:italic;">Note: ${item.instructions}</div>` : ''}
          `).join('')}

          <div class="divider"></div>
          ${!isKitchen ? `
            <div class="flex"><span>Subtotal:</span><span>₹${order.subtotal}</span></div>
            <div class="flex"><span>GST Tax:</span><span>₹${order.tax}</span></div>
            <div class="flex bold" style="font-size:15px; margin-top:5px;"><span>GRAND TOTAL:</span><span>₹${order.grandTotal}</span></div>
            <div class="divider"></div>
            <div>Payment Status: <strong>${order.paymentStatus} (${order.paymentMethod})</strong></div>
            <div>TXN ID: ${order.transactionId || 'N/A'}</div>
            <h4 style="text-align:center; margin-top:15px;">Thank You! Visit Again</h4>
          ` : `
            <div style="margin-top:10px;"><strong>Order Note:</strong> ${order.notes || 'None'}</div>
          `}
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Orders & Payment Datatable" />
        <div className="admin-content">

          {/* DATATABLE TOP CONTROLS */}
          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              
              {/* Search Box */}
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Live search order #, table #, customer, TXN ID..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ width: '100%', paddingLeft: '38px' }}
                />
              </div>

              {/* Status & Payment Filters */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All Order Statuses</option>
                  <option value="New">New (Pending)</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Ready">Ready</option>
                  <option value="Served">Served</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                  <option value="">All Payment Statuses</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Pending">Approval Pending</option>
                  <option value="Paid">Paid</option>
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

                <button onClick={fetchOrders} className="btn btn-secondary" title="Refresh Datatable">
                  <RefreshCw size={16} />
                </button>
              </div>

            </div>
          </div>

          {/* DATATABLE BODY */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <tr>
                  <th onClick={() => handleSort('orderNumber')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      ORDER # <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('tableNumber')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      TABLE <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('customerName')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      CUSTOMER <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('grandTotal')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      TOTAL <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('orderStatus')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      ORDER STATUS <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('paymentStatus')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      PAYMENT <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '0.8rem 1rem' }}>TXN ID</th>
                  <th onClick={() => handleSort('createdAt')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      TIME <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => (
                  <tr key={order._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: 'var(--primary)' }}>
                      {order.orderNumber}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontWeight: '700' }}>
                      Table {order.tableNumber}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: '600' }}>{order.customerName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{order.customerMobile || 'No phone'}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontWeight: '800', fontSize: '0.95rem' }}>
                      ₹{order.grandTotal}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <select
                        value={order.orderStatus}
                        onChange={(e) => updateStatus(order._id, e.target.value)}
                        className={`badge badge-${order.orderStatus.toLowerCase()}`}
                        style={{ cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="New">New</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Preparing">Preparing</option>
                        <option value="Ready">Ready</option>
                        <option value="Served">Served</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      {order.paymentStatus === 'Pending' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <span className="badge badge-pending">⏳ Approval Pending</span>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button
                              onClick={() => approvePayment(order._id)}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                              title="Approve Payment"
                            >
                              <CheckCircle2 size={13} /> Approve
                            </button>
                            <button
                              onClick={() => rejectPayment(order._id)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: '#dc2626' }}
                              title="Reject Payment"
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPaymentConfirm(order)}
                          className={`badge ${order.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-unpaid'}`}
                          style={{ cursor: 'pointer' }}
                        >
                          {order.paymentStatus === 'Paid' ? '✓ Paid' : '⏳ Unpaid'}
                        </button>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {order.transactionId || '-'}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                        <button onClick={() => setSelectedOrder(order)} className="btn btn-secondary btn-sm" title="View Details">
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => sendWhatsAppBill(order)}
                          disabled={billSendingId === order._id}
                          className="btn btn-secondary btn-sm"
                          title="WhatsApp PDF Bill"
                          style={{ color: '#25D366' }}
                        >
                          {billSendingId === order._id ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                        </button>
                        <button onClick={() => handlePrint(order, 'kitchen')} className="btn btn-secondary btn-sm" title="Print KOT">
                          <Printer size={14} /> KOT
                        </button>
                        <button onClick={() => handlePrint(order, 'bill')} className="btn btn-primary btn-sm" title="Print Bill">
                          <Printer size={14} /> Bill
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedOrders.length === 0 && !loading && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No orders found matching search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* DATATABLE FOOTER PAGINATION */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing {sortedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, sortedOrders.length)} of {sortedOrders.length} entries
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

      {/* Payment Yes/No Confirm Dialog */}
      {paymentConfirm && (
        <div className="modal-overlay" onClick={handlePaymentConfirmNo}>
          <div
            className="modal-card payment-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', textAlign: 'center' }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--secondary)' }}>
              Payment Status Change
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.35rem', lineHeight: 1.5 }}>
              Order <strong>#{paymentConfirm.order.orderNumber}</strong> (Table {paymentConfirm.order.tableNumber})
            </p>
            <p style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '1.25rem' }}>
              {paymentConfirm.newStatus === 'Paid'
                ? 'Kya aap is order ko Paid mark karna chahte hain?'
                : 'Kya aap is order ko Unpaid mark karna chahte hain?'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handlePaymentConfirmYes}
                className="btn btn-primary"
                style={{ minWidth: '100px', borderRadius: '10px' }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handlePaymentConfirmNo}
                className="btn btn-secondary"
                style={{ minWidth: '100px', borderRadius: '10px' }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Order #{selectedOrder.orderNumber}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Table {selectedOrder.tableNumber} • {new Date(selectedOrder.createdAt).toLocaleTimeString()}</span>
              </div>
              <span className={`badge badge-${selectedOrder.orderStatus.toLowerCase()}`}>
                {selectedOrder.orderStatus}
              </span>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.85rem' }}><strong>Customer:</strong> {selectedOrder.customerName} ({selectedOrder.customerMobile || 'N/A'})</div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}><strong>Notes:</strong> {selectedOrder.notes || 'None'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${
                  selectedOrder.paymentStatus === 'Paid'
                    ? 'badge-paid'
                    : selectedOrder.paymentStatus === 'Pending'
                      ? 'badge-pending'
                      : 'badge-unpaid'
                }`}>
                  {selectedOrder.paymentStatus === 'Pending' ? '⏳ Approval Pending' : selectedOrder.paymentStatus}
                </span>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', fontFamily: 'monospace' }}>TXN: {selectedOrder.transactionId || 'N/A'}</div>
                {selectedOrder.paymentStatus === 'Pending' && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => approvePayment(selectedOrder._id)} className="btn btn-primary btn-sm">
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button onClick={() => rejectPayment(selectedOrder._id)} className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.5rem' }}>Ordered Items</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{item.itemName} ({item.size})</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Qty: {item.quantity} x ₹{item.price} {item.instructions && `• (${item.instructions})`}
                    </div>
                  </div>
                  <div style={{ fontWeight: '700' }}>₹{item.total}</div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Subtotal:</span> <span>₹{selectedOrder.subtotal}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>GST Tax:</span> <span>₹{selectedOrder.tax}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: '800', marginTop: '0.4rem', color: 'var(--primary)' }}>
                <span>Grand Total:</span> <span>₹{selectedOrder.grandTotal}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => sendWhatsAppBill(selectedOrder)}
                disabled={billSendingId === selectedOrder?._id}
                className="btn btn-secondary"
                style={{ background: '#25D366', color: '#fff' }}
              >
                {billSendingId === selectedOrder?._id ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                WhatsApp PDF Bill
              </button>
              <button onClick={() => handlePrint(selectedOrder, 'kitchen')} className="btn btn-secondary">
                <Printer size={16} /> Kitchen KOT
              </button>
              <button onClick={() => handlePrint(selectedOrder, 'bill')} className="btn btn-primary">
                <Printer size={16} /> Customer Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
