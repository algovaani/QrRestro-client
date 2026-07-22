/** Normalize to local calendar date (strip time) */
export function toLocalDateOnly(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Membership expiry: durationDays includes the start/activation day.
 * e.g. 5-day trial starting Jul 20 → valid through Jul 24 (5 calendar days).
 */
export function addMembershipDays(startDate, durationDays) {
  const days = Math.max(1, Number(durationDays) || 0);
  const start = toLocalDateOnly(startDate);
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + days - 1);
  return expiry;
}

/** Calendar-day difference; expiry date is the last valid day (inclusive). */
export function getDaysRemaining(expiryDate, fromDate = new Date()) {
  if (!expiryDate) return 0;
  const expiry = toLocalDateOnly(expiryDate);
  const from = toLocalDateOnly(fromDate);
  const diffDays = Math.round((expiry - from) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays + 1);
}

export function isTrialPlanName(name) {
  return /free trial|trial|free plan/i.test(String(name || ''));
}

export function isFreePlan(planOrName, price) {
  if (planOrName && typeof planOrName === 'object') {
    const p = planOrName;
    return Number(p.price) === 0 || isTrialPlanName(p.name);
  }
  const numericPrice = Number(price);
  if (Number.isFinite(numericPrice) && numericPrice === 0) return true;
  return isTrialPlanName(planOrName);
}

export function inferPlanNameFromDays(days) {
  if (days <= 5) return '5-Day Free Trial';
  if (days <= 35) return 'Monthly Plan';
  if (days <= 95) return 'Quarterly Plan';
  return 'Annual Plan';
}

/** Display-only plan label when DB still has trial name after upgrade. */
export function resolveMembershipDisplay(user) {
  const expiry = user?.subscriptionEndsAt || user?.trialEndsAt;
  const daysRemaining = getDaysRemaining(expiry);
  let planName = user?.displayPlanName || user?.planName || 'Plan';

  if (isTrialPlanName(user?.planName) && daysRemaining > 5 && user?.planStatus === 'Active') {
    planName = inferPlanNameFromDays(daysRemaining);
  }

  return {
    planName,
    daysRemaining,
    expiryDate: expiry
  };
}

export function formatExpiryDate(date) {
  if (!date) return '';
  return toLocalDateOnly(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function getMembershipDaysLabel(days) {
  if (days <= 0) return 'Expired';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}
