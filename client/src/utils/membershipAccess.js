/** Admin ko Buy/Renew Membership tab dikhe jab account active ho aur Super Admin offer bheje ya request pending ho */
export function canShowMembershipOption(user) {
  if (!user || user.role !== 'Admin') return false;
  if (user.isActive === false) return false;
  return Boolean(user.membershipOfferSent || user.renewalRequested);
}

/** Membership page — band/expired admin bhi dekh sakta hai jab offer ya pending request ho */
export function canAccessMembershipPage(user) {
  if (!user || user.role !== 'Admin') return false;
  return Boolean(user.membershipOfferSent || user.renewalRequested);
}
