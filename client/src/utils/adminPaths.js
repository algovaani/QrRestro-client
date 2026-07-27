export function isBranchAdmin(user) {
  return user?.role === 'BranchAdmin';
}

/** Base path for admin portal vs branch portal */
export function getPortalBase(user) {
  return isBranchAdmin(user) ? '/branch' : '/admin';
}

export function portalPath(user, segment) {
  const base = getPortalBase(user);
  const path = segment.startsWith('/') ? segment : `/${segment}`;
  return `${base}${path}`;
}

export function getLoginPath() {
  return '/admin/login';
}

/** Features only available in branch/kitchen portal (not restaurant admin dashboard) */
export const BRANCH_ONLY_SEGMENTS = ['/kitchen'];

export function isBranchOnlyAdminPath(pathname) {
  return BRANCH_ONLY_SEGMENTS.some((seg) => pathname === `/admin${seg}` || pathname.startsWith(`/admin${seg}/`));
}
