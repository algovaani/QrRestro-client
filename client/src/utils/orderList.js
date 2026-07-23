export const getOrderId = (order) => String(order?._id || order?.id || '');

export const prependUniqueOrder = (orders, order) => {
  const orderId = getOrderId(order);
  if (!orderId) return orders;
  if (orders.some((o) => getOrderId(o) === orderId)) return orders;
  return [order, ...orders];
};

export const upsertOrder = (orders, order) => {
  const orderId = getOrderId(order);
  if (!orderId) return orders;
  const idx = orders.findIndex((o) => getOrderId(o) === orderId);
  if (idx === -1) return [order, ...orders];
  return orders.map((o) => (getOrderId(o) === orderId ? order : o));
};
