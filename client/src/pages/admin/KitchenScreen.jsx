import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useSocket } from '../../context/SocketContext';
import { prependUniqueOrder, upsertOrder } from '../../utils/orderList';
import { ChefHat, CheckCircle2, Clock, PlayCircle } from 'lucide-react';

export default function KitchenScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    fetchKitchenOrders();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      setOrders((prev) => prependUniqueOrder(prev, newOrder));
    };

    const handleStatusUpdate = (updatedOrder) => {
      // If completed or cancelled, remove from kitchen screen
      if (['Served', 'Completed', 'Cancelled'].includes(updatedOrder.orderStatus)) {
        setOrders((prev) => prev.filter((o) => o._id !== updatedOrder._id));
      } else {
        setOrders((prev) => upsertOrder(prev, updatedOrder));
      }
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_update', handleStatusUpdate);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_update', handleStatusUpdate);
    };
  }, [socket]);

  const fetchKitchenOrders = async () => {
    try {
      const res = await API.get('/orders');
      if (res.data.success) {
        // Only show active kitchen orders (New, Confirmed, Preparing, Ready)
        const kitchenOrders = res.data.orders.filter(o =>
          ['New', 'Confirmed', 'Preparing', 'Ready'].includes(o.orderStatus)
        );
        setOrders(kitchenOrders);
      }
    } catch (err) {
      console.error('Error loading kitchen screen orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await API.patch(`/orders/${orderId}/status`, { orderStatus: newStatus });
      if (['Served', 'Completed', 'Cancelled'].includes(newStatus)) {
        setOrders(prev => prev.filter(o => o._id !== orderId));
      }
    } catch (err) {
      alert('Error updating status');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Kitchen Order Display (KDS)" />
        <div className="admin-content">

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
              <ChefHat size={22} color="var(--primary)" />
              <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Active Kitchen Tickets ({orders.length})</span>
            </div>
            <button onClick={fetchKitchenOrders} className="btn btn-secondary btn-sm">
              Refresh Screen
            </button>
          </div>

          {/* KDS Grid */}
          <div className="kds-grid">
            {orders.map((order) => (
              <div key={order._id} className={`kds-card ${order.orderStatus === 'New' ? 'new-order' : ''}`}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)' }}>
                        Table {order.tableNumber}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        #{order.orderNumber} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`badge badge-${order.orderStatus.toLowerCase()}`}>
                      {order.orderStatus}
                    </span>
                  </div>

                  {/* Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '0.95rem' }}>
                          <span>{item.itemName} ({item.size})</span>
                          <span style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>x{item.quantity}</span>
                        </div>
                        {item.instructions && (
                          <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '0.2rem', fontWeight: '600' }}>
                            ⚠️ Note: {item.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Big Touch Friendly Kitchen Action Buttons */}
                <div>
                  {order.orderStatus === 'New' || order.orderStatus === 'Confirmed' ? (
                    <button
                      onClick={() => updateStatus(order._id, 'Preparing')}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', background: '#f59e0b' }}
                    >
                      <PlayCircle size={18} /> Start Preparing
                    </button>
                  ) : order.orderStatus === 'Preparing' ? (
                    <button
                      onClick={() => updateStatus(order._id, 'Ready')}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', background: 'var(--success)' }}
                    >
                      <CheckCircle2 size={18} /> Mark Order Ready
                    </button>
                  ) : (
                    <button
                      onClick={() => updateStatus(order._id, 'Served')}
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '0.8rem' }}
                    >
                      Mark Served & Clear
                    </button>
                  )}
                </div>
              </div>
            ))}

            {orders.length === 0 && !loading && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '12px', color: 'var(--text-muted)' }}>
                🎉 Kitchen queue is currently clear! No active pending tickets.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
