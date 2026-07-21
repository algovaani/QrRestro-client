/** Admin can always open the membership page — for renew / request */
export function canShowMembershipOption(user) {
  return user?.role === 'Admin';
}

export function canAccessMembershipPage(user) {
  return user?.role === 'Admin';
}

/** Only when account is deactivated and no offer/request exists — rare legacy state */
export function isAdminAccountLocked(user) {
  if (!user || user.role !== 'Admin') return false;
  return user.isActive === false && !user.membershipOfferSent && !user.renewalRequested;
}
