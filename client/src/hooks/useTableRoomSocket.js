import { useEffect, useRef } from 'react';
import { getTableRoom } from '../context/SocketContext';
import { tableNumbersMatch, normalizeBranchId } from '../utils/orderNotifications';

export function useTableRoomSocket(socket, adminId, tableNumber, branchId, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!socket || !adminId || !tableNumber) return;

    const room = getTableRoom(adminId, tableNumber, branchId);
    const sessionBranch = normalizeBranchId(branchId);

    const belongsToThisTable = (order) => {
      if (!order?.adminId || String(order.adminId) !== String(adminId)) return false;
      if (!tableNumbersMatch(order.tableNumber, tableNumber)) return false;

      const orderBranch = normalizeBranchId(order.branchId);
      if (sessionBranch) {
        if (!orderBranch || orderBranch !== sessionBranch) return false;
      }
      return true;
    };

    const joinRoom = () => {
      socket.emit('join_room', room);
    };

    joinRoom();
    socket.on('connect', joinRoom);

    const onStatusUpdate = (order) => {
      if (!belongsToThisTable(order)) return;
      handlersRef.current.onStatusUpdate?.(order);
    };
    const onPaymentPending = (order) => {
      if (!belongsToThisTable(order)) return;
      handlersRef.current.onPaymentPending?.(order);
    };
    const onPaymentSuccess = (order) => {
      if (!belongsToThisTable(order)) return;
      handlersRef.current.onPaymentSuccess?.(order);
    };
    const onNewOrder = (order) => {
      if (!belongsToThisTable(order)) return;
      handlersRef.current.onNewOrder?.(order);
    };

    socket.on('order_status_update', onStatusUpdate);
    socket.on('payment_pending', onPaymentPending);
    socket.on('payment_success', onPaymentSuccess);
    socket.on('new_order', onNewOrder);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('order_status_update', onStatusUpdate);
      socket.off('payment_pending', onPaymentPending);
      socket.off('payment_success', onPaymentSuccess);
      socket.off('new_order', onNewOrder);
      socket.emit('leave_room', room);
    };
  }, [socket, adminId, tableNumber, branchId]);
}
