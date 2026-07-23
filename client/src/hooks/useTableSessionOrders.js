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

export function getPayableOrders(orders = []) {
  return (orders || []).filter((o) => o.paymentStatus === 'Unpaid');
}

export function getUnpaidOrders(orders = []) {
  return (orders || []).filter(
    (o) => o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Pending'
  );
}

export function getUnpaidOrdersTotal(orders = []) {
  return getUnpaidOrders(orders).reduce(
    (sum, o) => sum + (Number(o.grandTotal) || 0),
    0
  );
}

/** @returns {'none'|'single'|'picker'} */
export function resolvePayFlow(orders = []) {
  const unpaid = getUnpaidOrders(orders);
  if (unpaid.length === 0) return { mode: 'none', unpaidOrders: [] };
  if (unpaid.length === 1) return { mode: 'single', unpaidOrders: unpaid, orderNumber: unpaid[0].orderNumber };
  return { mode: 'picker', unpaidOrders: unpaid };
}

export function getPayOrderNumber(orders) {
  const { mode, orderNumber } = resolvePayFlow(orders);
  if (mode === 'single') return orderNumber;
  const unpaid = getUnpaidOrders(orders);
  return unpaid[0]?.orderNumber ?? null;
}
