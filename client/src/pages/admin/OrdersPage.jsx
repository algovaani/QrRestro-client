import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useSocket } from '../../context/SocketContext';
import { prependUniqueOrder, upsertOrder, getOrderId } from '../../utils/orderList';
import { useLivePolling } from '../../hooks/useLivePolling';
import { useAuth } from '../../context/AuthContext';
import { sendOrderBillOnWhatsApp } from '../../utils/billShare';
import { belongsToTenant } from '../../utils/tenant';
import { useBranch } from '../../context/BranchContext';
import OrderRatingDisplay from '../../components/admin/OrderRatingDisplay';
import OrderBranchBadge from '../../components/admin/OrderBranchBadge';
import { resolveOrderBranchName, formatOrderTableLabel } from '../../utils/orderBranch';
import { buildBranchOrderGroups, computeOrderDayStats, filterOrdersByDay } from '../../utils/orderBranchGroups';
import { Printer, Eye, RefreshCw, MessageSquare, Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, MapPin, CalendarDays } from 'lucide-react';

export default function OrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const paymentClickBlockRef = useRef(false);

  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const { branchQueryParams, getBranchName, hasMultipleBranches, branches, isAllBranches, isBranchLocked, setSelectedBranchId } = useBranch();
  const showBranchGroupedView = hasMultipleBranches && isAllBranches && !isBranchLocked;
  const [dayFilter, setDayFilter] = useState('all');
  const [expandedBranches, setExpandedBranches] = useState(() => new Set());
  const [billSendingId, setBillSendingId] = useState(null);
  const [restaurantBillInfo, setRestaurantBillInfo] = useState({
    contactNumber: '',
    address: '',
    gstNumber: ''
  });

  useEffect(() => {
    API.get('/settings')
      .then((res) => {
        const s = res.data?.setting || res.data?.settings || {};
        setRestaurantBillInfo({
          contactNumber: s.mobile || '',
          address: s.address || '',
          gstNumber: s.gstNumber || ''
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isBranchLocked && hasMultipleBranches) {
      setSelectedBranchId('all');
    }
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      setExpandedBranches(new Set(branches.map((b) => String(b._id))));
    }
  }, [branches]);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, paymentFilter, user?._id, showBranchGroupedView, branchQueryParams.branchId]);

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

  const stripOrderFromUrl = () => {
    const params = new URLSearchParams(location.search);
    if (!params.has('order')) return;
    params.delete('order');
    const nextSearch = params.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true }
    );
  };

  const closeOrderModal = () => {
    setSelectedOrder(null);
    stripOrderFromUrl();
  };

  const openOrderModal = (order) => {
    setSelectedOrder(order);
    stripOrderFromUrl();
  };

  // Open order from notification link (?order=ORD-1163), then remove param so reload won't reopen
  useEffect(() => {
    const orderParam = new URLSearchParams(location.search).get('order') || '';
    if (!orderParam || loading) return;

    const match = orders.find((o) => o.orderNumber === orderParam);
    if (match) {
      setSelectedOrder(match);
    }
    stripOrderFromUrl();
  }, [location.search, orders, loading]);

  const enrichOrderBranch = (order) => {
    if (!order) return order;
    const branchName = resolveOrderBranchName(order, getBranchName);
    return branchName && branchName !== order.branchName ? { ...order, branchName } : order;
  };

  // Real-time WebSocket handlers - HAND TO HAND SOCKET PROCESS
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      if (!belongsToTenant(newOrder, user?._id)) return;
      setOrders((prev) => prependUniqueOrder(prev, enrichOrderBranch(newOrder)));
    };

    const handleStatusUpdate = (updatedOrder) => {
      if (!belongsToTenant(updatedOrder, user?._id)) return;
      const enriched = enrichOrderBranch(updatedOrder);
      setOrders((prev) => upsertOrder(prev, enriched));
      if (selectedOrder && getOrderId(selectedOrder) === getOrderId(enriched)) {
        setSelectedOrder(enriched);
      }
    };

    const handlePaymentPending = (updatedOrder) => {
      if (!belongsToTenant(updatedOrder, user?._id)) return;
      const enriched = enrichOrderBranch(updatedOrder);
      setOrders((prev) => upsertOrder(prev, enriched));
      if (selectedOrder && getOrderId(selectedOrder) === getOrderId(enriched)) {
        setSelectedOrder(enriched);
      }
    };

    const handlePaymentSuccess = (updatedOrder) => {
      if (!belongsToTenant(updatedOrder, user?._id)) return;
      const enriched = enrichOrderBranch(updatedOrder);
      setOrders((prev) => upsertOrder(prev, enriched));
      if (selectedOrder && getOrderId(selectedOrder) === getOrderId(enriched)) {
        setSelectedOrder(enriched);
      }
    };

    const handleOrderRating = (updatedOrder) => {
      if (!belongsToTenant(updatedOrder, user?._id)) return;
      const enriched = enrichOrderBranch(updatedOrder);
      setOrders((prev) => upsertOrder(prev, enriched));
      if (selectedOrder && getOrderId(selectedOrder) === getOrderId(enriched)) {
        setSelectedOrder(enriched);
      }
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_update', handleStatusUpdate);
    socket.on('payment_pending', handlePaymentPending);
    socket.on('payment_success', handlePaymentSuccess);
    socket.on('order_rating', handleOrderRating);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_update', handleStatusUpdate);
      socket.off('payment_pending', handlePaymentPending);
      socket.off('payment_success', handlePaymentSuccess);
      socket.off('order_rating', handleOrderRating);
    };
  }, [socket, selectedOrder, user?._id, getBranchName]);

  const fetchOrders = async () => {
    try {
      const params = {
        status: statusFilter,
        paymentStatus: paymentFilter
      };
      if (!showBranchGroupedView && branchQueryParams.branchId) {
        params.branchId = branchQueryParams.branchId;
      }
      const res = await API.get('/orders', { params });
      if (res.data.success) {
        setOrders((res.data.orders || []).map((order) => enrichOrderBranch(order)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useLivePolling(fetchOrders, 15000, true);

  const updateStatus = async (orderId, newStatus) => {
    const targetId = getOrderId({ _id: orderId });
    if (!targetId) return;

    try {
      const res = await API.patch(`/orders/${targetId}/status`, { orderStatus: newStatus });
      if (res.data.success) {
        setOrders((prev) => prev.map((o) => (getOrderId(o) === targetId ? res.data.order : o)));
        if (selectedOrder && getOrderId(selectedOrder) === targetId) {
          setSelectedOrder(res.data.order);
        }
      }
    } catch (err) {
      alert('Failed to update order status');
    }
  };

  const approvePayment = async (orderId) => {
    const targetId = getOrderId({ _id: orderId });
    if (!targetId) return;
    if (!window.confirm('Approve this payment and mark the order as Paid?')) return;

    try {
      const res = await API.post(`/payment/approve/${targetId}`);
      if (res.data.success) {
        const order = res.data.order;
        setOrders((prev) => prev.map((o) => (getOrderId(o) === targetId ? order : o)));
        if (selectedOrder && getOrderId(selectedOrder) === targetId) {
          setSelectedOrder(order);
        }

        if (order?.customerMobile && window.confirm('Payment approved. Send PDF bill to customer on WhatsApp now?')) {
          try {
            await sendOrderBillOnWhatsApp(order, {
              forAdmin: true,
              restaurantName: user?.restaurantName || res.data.bill?.restaurantName || 'Royal Spice Restaurant',
              taxLabel: res.data.bill?.taxLabel || 'GST Tax',
              contactNumber: res.data.bill?.contactNumber || restaurantBillInfo.contactNumber,
              address: res.data.bill?.address || restaurantBillInfo.address,
              gstNumber: res.data.bill?.gstNumber || restaurantBillInfo.gstNumber
            });
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
    const targetId = getOrderId({ _id: orderId });
    if (!targetId) return;
    if (!window.confirm('Reject this payment? Customer will need to pay again.')) return;
    try {
      const res = await API.post(`/payment/reject/${targetId}`);
      if (res.data.success) {
        setOrders((prev) => prev.map((o) => (getOrderId(o) === targetId ? res.data.order : o)));
        if (selectedOrder && getOrderId(selectedOrder) === targetId) {
          setSelectedOrder(res.data.order);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject payment');
    }
  };

  const updatePayment = async (orderId, paymentStatus, paymentMethod = 'UPI') => {
    const targetId = getOrderId({ _id: orderId });
    if (!targetId) return;
    try {
      const res = await API.patch(`/orders/${targetId}/payment`, { paymentStatus, paymentMethod });
      if (res.data.success) {
        setOrders((prev) => prev.map((o) => (getOrderId(o) === targetId ? res.data.order : o)));
        if (selectedOrder && getOrderId(selectedOrder) === targetId) {
          setSelectedOrder(res.data.order);
        }
      }
    } catch (err) {
      alert('Failed to update payment status');
    }
  };

  const blockPaymentBadgeClick = () => {
    paymentClickBlockRef.current = true;
    window.setTimeout(() => {
      paymentClickBlockRef.current = false;
    }, 400);
  };

  const openPaymentConfirm = (order) => {
    if (paymentClickBlockRef.current) return;
    const newStatus = order.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    setPaymentConfirm({ order, newStatus });
  };

  const closePaymentConfirm = () => {
    setPaymentConfirm(null);
    blockPaymentBadgeClick();
  };

  const handlePaymentConfirmYes = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!paymentConfirm) return;
    const { order, newStatus } = paymentConfirm;
    setPaymentConfirm(null);
    blockPaymentBadgeClick();
    await updatePayment(order._id, newStatus);
  };

  const handlePaymentConfirmNo = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    closePaymentConfirm();
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
      const branchName = resolveOrderBranchName(order, getBranchName).toLowerCase();
      return (
        order.orderNumber.toLowerCase().includes(query) ||
        `table ${order.tableNumber}`.toLowerCase().includes(query) ||
        order.tableNumber.toString().includes(query) ||
        branchName.includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        (order.customerMobile && order.customerMobile.includes(query)) ||
        order.orderStatus.toLowerCase().includes(query) ||
        order.paymentStatus.toLowerCase().includes(query) ||
        (order.transactionId && order.transactionId.toLowerCase().includes(query)) ||
        (order.rating && String(order.rating).includes(query)) ||
        (order.review && order.review.toLowerCase().includes(query))
      );
    });
  }, [orders, searchTerm, getBranchName]);

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

  const globalDayStats = useMemo(
    () => computeOrderDayStats(filteredOrders),
    [filteredOrders]
  );

  const branchOrderGroups = useMemo(() => {
    if (!showBranchGroupedView) return [];
    const resolveName = (order) => resolveOrderBranchName(order, getBranchName);
    return buildBranchOrderGroups(filteredOrders, branches, getBranchName, resolveName).map((group) => ({
      ...group,
      visibleOrders: filterOrdersByDay(
        [...group.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        dayFilter
      )
    }));
  }, [showBranchGroupedView, filteredOrders, branches, getBranchName, dayFilter]);

  const toggleBranchExpand = (branchId) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const formatRupee = (amount) => `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;

  const sendWhatsAppBill = async (order) => {
    if (!order?.customerMobile) {
      alert('Customer mobile number is missing — cannot send bill on WhatsApp.');
      return;
    }

    setBillSendingId(order._id);
    try {
      const result = await sendOrderBillOnWhatsApp(order, {
        forAdmin: true,
        restaurantName: user?.restaurantName || 'Royal Spice Restaurant',
        ...restaurantBillInfo
      });
      if (result.cancelled) return;
    } catch {
      alert('Could not generate or share bill PDF. Please try again.');
    } finally {
      setBillSendingId(null);
    }
  };

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return String(Math.round(n));
  };

  const lineItemTotal = (item) => {
    const qty = Number(item.quantity) || 1;
    const total = Number(item.total);
    if (Number.isFinite(total)) return total;
    return (Number(item.price) || 0) * qty;
  };

  const handlePrint = (order, type) => {
    const printWindow = window.open('', '_blank');
    const isKitchen = type === 'kitchen';
    const branchName = resolveOrderBranchName(order, getBranchName);

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
          ${branchName ? `<div>Branch: <strong>${branchName}</strong></div>` : ''}
          <div>Date: ${new Date(order.createdAt).toLocaleString()}</div>
          ${!isKitchen ? `<div>Customer: ${order.customerName} (${order.customerMobile || 'N/A'})</div>` : ''}
          <div class="divider"></div>

          ${order.items.map(item => `
            <div class="flex bold">
              <span>${item.itemName} (${item.size})</span>
              ${!isKitchen ? `<span>₹${formatMoney(lineItemTotal(item))}</span>` : `<span>× ${item.quantity}</span>`}
            </div>
            ${!isKitchen ? `<div style="font-size:11px; color:#444; margin-bottom:4px;">Qty: ${item.quantity} @ ₹${formatMoney(item.price)} each</div>` : ''}
            ${item.instructions ? `<div style="font-size:11px; font-style:italic;">Note: ${item.instructions}</div>` : ''}
          `).join('')}

          <div class="divider"></div>
          ${!isKitchen ? `
            <div class="flex"><span>Subtotal:</span><span>₹${formatMoney(order.subtotal)}</span></div>
            <div class="flex"><span>GST Tax:</span><span>₹${formatMoney(order.tax)}</span></div>
            <div class="flex bold" style="font-size:15px; margin-top:5px;"><span>GRAND TOTAL:</span><span>₹${formatMoney(order.grandTotal)}</span></div>
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

  const renderOrderRow = (order) => (
    <tr key={order._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: 'var(--primary)' }}>
        {order.orderNumber}
      </td>

      {!showBranchGroupedView && hasMultipleBranches && (
        <td style={{ padding: '0.85rem 1rem' }}>
          <OrderBranchBadge name={resolveOrderBranchName(order, getBranchName)} />
        </td>
      )}

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
          key={`status-${getOrderId(order)}`}
          value={order.orderStatus}
          onChange={(e) => updateStatus(getOrderId(order), e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`badge badge-${order.orderStatus.toLowerCase()} admin-order-status-select`}
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

      <td className="order-rating-cell" style={{ padding: '0.85rem 1rem' }}>
        {order.rating ? (
          <OrderRatingDisplay rating={order.rating} review={order.review} compact />
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
        )}
      </td>

      <td className="admin-table-txn-cell" style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {order.transactionId || '-'}
      </td>

      <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {new Date(order.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </td>

      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
          <button onClick={() => openOrderModal(order)} className="btn btn-secondary btn-sm" title="View Details">
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
  );

  const tableHeadRow = (
    <tr>
      <th onClick={() => handleSort('orderNumber')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          ORDER # <ArrowUpDown size={12} />
        </div>
      </th>
      {!showBranchGroupedView && hasMultipleBranches && (
        <th style={{ padding: '0.8rem 1rem' }}>BRANCH</th>
      )}
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
      <th onClick={() => handleSort('rating')} style={{ padding: '0.8rem 1rem', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          RATING <ArrowUpDown size={12} />
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
  );

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title={showBranchGroupedView ? 'Orders — Branch Wise' : 'Orders & Payment'} />
        <div className="admin-content">

          {showBranchGroupedView && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Aaj (Today)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>{globalDayStats.today.count}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatRupee(globalDayStats.today.revenue)}</div>
                </div>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #6366f1' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Kal (Yesterday)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4338ca' }}>{globalDayStats.yesterday.count}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatRupee(globalDayStats.yesterday.revenue)}</div>
                </div>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #15803d' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total Orders</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d' }}>{globalDayStats.total.count}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatRupee(globalDayStats.total.revenue)}</div>
                </div>
                <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #b45309' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Branches</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#b45309' }}>{branches.length}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Alag-alag section mein</div>
                </div>
              </div>

              <div className="admin-panel admin-panel--padded" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <CalendarDays size={18} color="var(--primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', marginRight: '0.35rem' }}>Din filter:</span>
                {[
                  { id: 'all', label: 'Sabhi Orders' },
                  { id: 'today', label: 'Sirf Aaj' },
                  { id: 'yesterday', label: 'Sirf Kal' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDayFilter(opt.id)}
                    className={dayFilter === opt.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {!showBranchGroupedView && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Aaj</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{globalDayStats.today.count} orders</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatRupee(globalDayStats.today.revenue)}</div>
              </div>
              <div className="admin-panel admin-panel--padded" style={{ borderLeft: '4px solid #6366f1' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Kal</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{globalDayStats.yesterday.count} orders</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatRupee(globalDayStats.yesterday.revenue)}</div>
              </div>
            </div>
          )}

          {/* DATATABLE TOP CONTROLS */}
          <div className="admin-panel admin-panel--padded" style={{ marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div className="admin-toolbar">
              
              {/* Search Box */}
              <div className="admin-toolbar-search">
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
              <div className="admin-toolbar-filters">
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

          {/* ORDERS BODY */}
          {showBranchGroupedView ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {branchOrderGroups.map((group) => {
                const isExpanded = expandedBranches.has(group.branchId);
                return (
                  <div key={group.branchId} className="admin-panel" style={{ overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => toggleBranchExpand(group.branchId)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        padding: '1rem 1.15rem',
                        background: '#f8fafc',
                        border: 'none',
                        borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <MapPin size={18} color="var(--primary)" />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--secondary)' }}>
                            {group.branchName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Aaj: <strong>{group.stats.today.count}</strong> orders ({formatRupee(group.stats.today.revenue)})
                            {' · '}
                            Kal: <strong>{group.stats.yesterday.count}</strong> orders ({formatRupee(group.stats.yesterday.revenue)})
                            {' · '}
                            Total: <strong>{group.stats.total.count}</strong>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                        <OrderBranchBadge name={group.branchName} compact />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {group.visibleOrders.length} dikha rahe hain
                        </span>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="admin-table-wrap">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                          <thead style={{ background: '#fff', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {tableHeadRow}
                          </thead>
                          <tbody>
                            {group.visibleOrders.map((order) => renderOrderRow(order))}
                            {group.visibleOrders.length === 0 && !loading && (
                              <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  {dayFilter === 'today'
                                    ? 'Aaj is branch mein koi order nahi.'
                                    : dayFilter === 'yesterday'
                                      ? 'Kal is branch mein koi order nahi.'
                                      : 'Is branch mein abhi koi order nahi.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {branchOrderGroups.length === 0 && !loading && (
                <div className="admin-panel admin-panel--padded" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Koi branch ya order nahi mila.
                </div>
              )}
            </div>
          ) : (
          <div className="admin-panel">
            <div className="admin-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {tableHeadRow}
              </thead>
              <tbody>
                {paginatedOrders.map((order) => renderOrderRow(order))}
                {paginatedOrders.length === 0 && !loading && (
                  <tr>
                    <td colSpan={hasMultipleBranches ? 11 : 10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No orders found matching search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {/* DATATABLE FOOTER PAGINATION */}
            <div className="admin-datatable-footer">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing {sortedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, sortedOrders.length)} of {sortedOrders.length} entries
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
          )}

        </div>
      </div>

      {/* Payment Yes/No Confirm Dialog */}
      {paymentConfirm && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              closePaymentConfirm();
            }
          }}
        >
          <div
            className="modal-card payment-confirm-dialog"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', textAlign: 'center' }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--secondary)' }}>
              Payment Status Change
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.35rem', lineHeight: 1.5 }}>
              Order <strong>#{paymentConfirm.order.orderNumber}</strong> ({formatOrderTableLabel(paymentConfirm.order, getBranchName)})
            </p>
            <p style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '1.25rem' }}>
              {paymentConfirm.newStatus === 'Paid'
                ? 'Mark this order as Paid?'
                : 'Mark this order as Unpaid?'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handlePaymentConfirmYes}
                className="btn btn-primary"
                style={{ minWidth: '100px', borderRadius: '10px' }}
              >
                Yes
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
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
        <div className="modal-overlay" onClick={closeOrderModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Order #{selectedOrder.orderNumber}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {formatOrderTableLabel(selectedOrder, getBranchName)} • {new Date(selectedOrder.createdAt).toLocaleTimeString()}
                </span>
                {hasMultipleBranches && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <OrderBranchBadge name={resolveOrderBranchName(selectedOrder, getBranchName)} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`badge badge-${selectedOrder.orderStatus.toLowerCase()}`}>
                  {selectedOrder.orderStatus}
                </span>
                <button type="button" onClick={closeOrderModal} className="btn btn-secondary btn-sm" aria-label="Close order details">
                  <XCircle size={16} />
                </button>
              </div>
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

            <div style={{ background: selectedOrder.rating ? '#fffbeb' : '#f8fafc', border: `1px solid ${selectedOrder.rating ? '#fcd34d' : 'var(--border)'}`, borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--secondary)' }}>
                Customer Rating & Review
              </h4>
              <OrderRatingDisplay rating={selectedOrder.rating} review={selectedOrder.review} />
            </div>

            <div className="admin-order-modal-actions">
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
