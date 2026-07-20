// Helper to extract the tenant's adminId based on logged in user's role
exports.getTenantAdminId = (user) => {
  if (!user) return null;
  if (user.role === 'Admin') return user._id;
  if (user.role === 'Kitchen') return user.restaurantAdminId || user._id;
  if (user.role === 'SuperAdmin') return null; // Null means no tenant restriction (SuperAdmin mode)
  return user._id;
};
