/** Format INR amounts for bills (whole rupees, no stray decimals) */
export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n));
}

/** UI / WhatsApp — Unicode rupee symbol */
export function formatMoneyWithSymbol(value) {
  return `₹${formatMoney(value)}`;
}

/** PDF fonts (Helvetica) cannot render ₹ — use Rs. prefix */
export function formatMoneyForPdf(value) {
  return `Rs. ${formatMoney(value)}`;
}
