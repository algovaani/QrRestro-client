/** Normalize to local calendar date (strip time) */
function toLocalDateOnly(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Membership expiry: durationDays includes the start/activation day.
 * e.g. 5-day trial starting Jul 20 → valid through Jul 24 (5 calendar days).
 */
function addMembershipDays(startDate, durationDays) {
  const days = Math.max(1, Number(durationDays) || 0);
  const start = toLocalDateOnly(startDate);
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + days - 1);
  return expiry;
}

/** Calendar-day difference; expiry date is the last valid day (inclusive). */
function getDaysRemaining(expiryDate, fromDate = new Date()) {
  if (!expiryDate) return 0;
  const expiry = toLocalDateOnly(expiryDate);
  const from = toLocalDateOnly(fromDate);
  const diffDays = Math.round((expiry - from) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays + 1);
}

function isTrialPlanName(name) {
  return /free trial|trial/i.test(String(name || ''));
}

function inferPlanNameFromDays(days) {
  if (days <= 5) return '5-Day Free Trial';
  if (days <= 35) return 'Monthly Plan';
  if (days <= 95) return 'Quarterly Plan';
  return 'Annual Plan';
}

/** Display-only plan label when DB still has trial name after upgrade. */
function resolveMembershipDisplay(user) {
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

function formatExpiryDate(date) {
  if (!date) return '';
  return toLocalDateOnly(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatRenewalMessage(planName, expiryDate) {
  const daysLeft = getDaysRemaining(expiryDate);
  const dateStr = formatExpiryDate(expiryDate);
  return `Membership renewed & account reactivated! ${planName} — ${daysLeft} days left (until ${dateStr})`;
}

function withMembershipDays(userObj) {
  const display = resolveMembershipDisplay(userObj);
  return {
    ...userObj,
    daysRemaining: display.daysRemaining,
    displayPlanName: display.planName,
    isExpired: display.daysRemaining <= 0 && userObj.role === 'Admin'
  };
}

module.exports = {
  toLocalDateOnly,
  addMembershipDays,
  getDaysRemaining,
  formatExpiryDate,
  formatRenewalMessage,
  withMembershipDays,
  isTrialPlanName,
  inferPlanNameFromDays,
  resolveMembershipDisplay
};
