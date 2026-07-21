export function isAdminDashboardBlocked(user) {
  if (!user || user.role !== 'Admin') return true;
  if (user.isActive === false) return true;

  if (user.isExpired === true || user.planStatus === 'Expired') return true;

  const expiry = user.subscriptionEndsAt || user.trialEndsAt;
  if (expiry && new Date(expiry) < new Date()) return true;

  return false;
}

export function getPostLoginPath(user) {
  if (!user) return '/admin/login';
  if (user.role === 'SuperAdmin') return '/super-admin/dashboard';
  if (user.role === 'Kitchen') return '/admin/kitchen';
  if (isAdminDashboardBlocked(user)) return '/subscription-expired';
  return '/admin/dashboard';
}
