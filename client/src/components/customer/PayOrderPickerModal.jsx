import React from 'react';
import { X, QrCode, Layers } from 'lucide-react';
import { getPayableOrders, getPayableOrdersTotal } from '../../utils/customerPayFlow';

function formatOrderTime(createdAt) {
  if (!createdAt) return '';
  return new Date(createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function PayOrderPickerModal({ orders = [], allOrders = [], tableNumber, onClose, onPayOrder, onPayAll }) {
  const roundSource = allOrders.length ? allOrders : orders;
  const payableOrders = getPayableOrders(orders);
  const payableTotal = getPayableOrdersTotal(orders);
  const unpaidTotal = orders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

  const getRoundNum = (order) => {
    const idx = roundSource.findIndex((o) => String(o._id) === String(order._id));
    return idx >= 0 ? roundSource.length - idx : null;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card pay-order-picker" onClick={(e) => e.stopPropagation()}>
        <div className="pay-order-picker__header">
          <div>
            <h3 className="pay-order-picker__title">Select Order to Pay</h3>
            <p className="pay-order-picker__subtitle">
              Table {tableNumber} • {orders.length} unpaid order{orders.length !== 1 ? 's' : ''} • Total ₹{unpaidTotal}
            </p>
          </div>
          <button type="button" onClick={onClose} className="my-orders-modal__close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="pay-order-picker__hint">
          Pay one round separately, or pay all unpaid orders together in a single UPI payment.
        </p>

        <div className="pay-order-picker__list">
          {orders.map((order) => {
            const roundNum = getRoundNum(order);
            const isPending = order.paymentStatus === 'Pending';
            const canPay = order.paymentStatus === 'Unpaid';

            return (
              <div key={order._id} className="pay-order-picker__item">
                <div className="pay-order-picker__item-main">
                  <span className="my-orders-round__badge">Round #{roundNum ?? '—'}</span>
                  <strong className="pay-order-picker__order-num">{order.orderNumber}</strong>
                  <span className="pay-order-picker__time">{formatOrderTime(order.createdAt)}</span>
                  <span className={`badge badge-${isPending ? 'pending' : order.orderStatus?.toLowerCase() || 'new'}`}>
                    {isPending ? 'Payment Pending' : order.paymentStatus}
                  </span>
                </div>
                {canPay ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm pay-order-picker__pay-btn"
                    onClick={() => onPayOrder(order.orderNumber)}
                  >
                    <QrCode size={14} />
                    Pay ₹{order.grandTotal}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm pay-order-picker__pay-btn"
                    onClick={() => onPayOrder(order.orderNumber)}
                  >
                    View
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {payableOrders.length >= 2 && onPayAll && (
          <button
            type="button"
            className="btn btn-primary pay-order-picker__pay-all-btn"
            onClick={() => onPayAll(payableOrders.map((o) => o.orderNumber))}
          >
            <Layers size={18} />
            Pay All Together • ₹{payableTotal}
            <span className="pay-order-picker__pay-all-sub">
              {payableOrders.length} orders in one UPI payment
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
