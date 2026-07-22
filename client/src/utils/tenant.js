/** Returns true when an order belongs to the logged-in restaurant admin */
export function belongsToTenant(order, tenantId) {
  if (!tenantId || !order?.adminId) return false;
  return String(order.adminId) === String(tenantId);
}

export function getTenantIdFromUser(user) {
  if (!user) return null;
  if (user.role === 'Admin') return String(user._id);
  if (user.role === 'Kitchen' && user.restaurantAdminId) return String(user.restaurantAdminId);
  return null;
}
