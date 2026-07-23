import { getUnpaidOrders, getPayableOrders, resolvePayFlow } from '../hooks/useTableSessionOrders';

/**
 * Opens UPI for a single unpaid order, or the pay picker when several are unpaid.
 * @returns {boolean} true if a pay UI was opened
 */
export function startCustomerPayFlow(orders, tableNumber, { setPayOrderNumbers, setShowPayPicker, alertFn = alert }) {
  const { mode, orderNumber } = resolvePayFlow(orders);

  if (mode === 'none') {
    alertFn(
      tableNumber
        ? `No unpaid order yet for Table ${tableNumber}. Please place an order first.`
        : 'No unpaid order found. Please place an order first.'
    );
    return false;
  }

  if (mode === 'single') {
    setPayOrderNumbers([orderNumber]);
    return true;
  }

  setShowPayPicker(true);
  return true;
}

export function getPayableOrdersTotal(orders = []) {
  return getPayableOrders(orders).reduce(
    (sum, o) => sum + (Number(o.grandTotal) || 0),
    0
  );
}

export { getUnpaidOrders, getPayableOrders, resolvePayFlow };
