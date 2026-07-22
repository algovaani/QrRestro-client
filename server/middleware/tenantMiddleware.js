// Helper to extract the tenant's adminId based on logged in user's role
exports.getTenantAdminId = (user) => {
  if (!user) return null;
  if (user.role === 'Admin') return user._id;
  if (user.role === 'Kitchen') return user.restaurantAdminId || user._id;
  if (user.role === 'SuperAdmin') return null;
  return null;
};

/** Require tenant admin id for restaurant-scoped APIs (never return all tenants) */
exports.requireTenantAdminId = (user, res) => {
  const adminId = exports.getTenantAdminId(user);
  if (!adminId) {
    if (res) {
      res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }
    return null;
  }
  return adminId;
};

exports.buildTenantFilter = (user, res) => {
  const adminId = exports.requireTenantAdminId(user, res);
  if (!adminId) return null;
  return { adminId };
};

/** Ensure a document belongs to the current tenant before mutate/read by id */
exports.assertTenantOwnership = (doc, user, res, message = 'Not authorized to access this resource') => {
  const adminId = exports.getTenantAdminId(user);
  if (!adminId || !doc?.adminId || doc.adminId.toString() !== adminId.toString()) {
    if (res) {
      res.status(403).json({ success: false, message });
    }
    return false;
  }
  return true;
};
