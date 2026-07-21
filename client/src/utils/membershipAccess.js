/** Admin hamesha membership page khol sakta hai — renew / request ke liye */
export function canShowMembershipOption(user) {
  return user?.role === 'Admin';
}

export function canAccessMembershipPage(user) {
  return user?.role === 'Admin';
}

/** Sirf tab jab account band ho aur koi offer/request na ho — rare legacy state */
export function isAdminAccountLocked(user) {
  if (!user || user.role !== 'Admin') return false;
  return user.isActive === false && !user.membershipOfferSent && !user.renewalRequested;
}
