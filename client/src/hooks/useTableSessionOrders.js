import { useState, useEffect, useCallback } from 'react';
import API from '../services/api';

export function useTableSessionOrders(adminId, tableNumber, customerMobile) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshOrders = useCallback(async () => {
    if (!adminId || !tableNumber || !customerMobile) {
      setOrders([]);
      return;
    }

    setLoading(true);
    try {
      const res = await API.get(`/public/orders/table/${adminId}/${tableNumber}/active`, {
        params: { customerMobile }
      });
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [adminId, tableNumber, customerMobile]);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  return { orders, ordersCount: orders.length, loading, refreshOrders };
}

export function getPayOrderNumber(orders) {
  if (!orders?.length) return null;
  const pending = orders.find((o) => o.paymentStatus === 'Pending');
  const unpaid = orders.find((o) => o.paymentStatus === 'Unpaid');
  if (pending) return pending.orderNumber;
  if (unpaid) return unpaid.orderNumber;
  return orders[0].orderNumber;
}
