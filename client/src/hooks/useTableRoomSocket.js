import { useEffect, useRef } from 'react';
import { getTableRoom } from '../context/SocketContext';

export function useTableRoomSocket(socket, adminId, tableNumber, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!socket || !adminId || !tableNumber) return;

    const room = getTableRoom(adminId, tableNumber);

    const joinRoom = () => {
      socket.emit('join_room', room);
    };

    joinRoom();
    socket.on('connect', joinRoom);

    const onStatusUpdate = (order) => handlersRef.current.onStatusUpdate?.(order);
    const onPaymentPending = (order) => handlersRef.current.onPaymentPending?.(order);
    const onPaymentSuccess = (order) => handlersRef.current.onPaymentSuccess?.(order);
    const onNewOrder = (order) => handlersRef.current.onNewOrder?.(order);

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
  }, [socket, adminId, tableNumber]);
}
