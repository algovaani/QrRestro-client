/** Per-table customer profile — scoped by admin + branch + table (same mobile on Table 2 is separate) */
const STORAGE_KEY = 'customer_profile_by_table';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function tableKey(adminId, tableNumber, branchId = '') {
  if (!adminId || tableNumber === undefined || tableNumber === null || tableNumber === '') {
    return '';
  }
  const branchPart = branchId ? String(branchId) : 'legacy';
  return `${String(adminId)}::${branchPart}::${String(tableNumber)}`;
}

export function getSavedCustomerMobile(adminId, tableNumber, branchId = '') {
  return getSavedCustomerProfile(adminId, tableNumber, branchId).mobile;
}

export function getSavedCustomerName(adminId, tableNumber, branchId = '') {
  return getSavedCustomerProfile(adminId, tableNumber, branchId).name;
}

export function getSavedCustomerProfile(adminId, tableNumber, branchId = '') {
  const key = tableKey(adminId, tableNumber, branchId);
  if (!key) return { mobile: '', name: '' };

  const entry = readAll()[key];
  const mobile = entry?.mobile ? String(entry.mobile).trim() : '';
  const name = entry?.name ? String(entry.name).trim() : '';
  return {
    mobile: /^\d{10}$/.test(mobile) ? mobile : '',
    name
  };
}

export function saveCustomerMobileLogin(adminId, tableNumber, mobile, name = '', branchId = '') {
  const key = tableKey(adminId, tableNumber, branchId);
  if (!key || !/^\d{10}$/.test(String(mobile).trim())) return;

  const all = readAll();
  const prev = all[key] || {};
  all[key] = {
    mobile: String(mobile).trim(),
    name: String(name || prev.name || '').trim(),
    savedAt: Date.now()
  };
  writeAll(all);
}

/** Clears saved login for this table only (not other tables). */
export function clearCustomerMobileLogin(adminId, tableNumber, branchId = '') {
  const key = tableKey(adminId, tableNumber, branchId);
  if (!key) return;
  const all = readAll();
  delete all[key];
  writeAll(all);
}
