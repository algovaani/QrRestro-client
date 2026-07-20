export const prependUniqueOrder = (orders, order) => {
  if (!order?._id) return orders;
  if (orders.some((o) => String(o._id) === String(order._id))) return orders;
  return [order, ...orders];
};

export const upsertOrder = (orders, order) => {
  if (!order?._id) return orders;
  const idx = orders.findIndex((o) => String(o._id) === String(order._id));
  if (idx === -1) return [order, ...orders];
  return orders.map((o) => (String(o._id) === String(order._id) ? order : o));
};
