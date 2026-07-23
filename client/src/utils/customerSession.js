/** Per-table customer profile — same mobile on Table 2 is a separate session from Table 1 */
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

function tableKey(adminId, tableNumber) {
  if (!adminId || tableNumber === undefined || tableNumber === null || tableNumber === '') {
    return '';
  }
  return `${String(adminId)}::${String(tableNumber)}`;
}

export function getSavedCustomerMobile(adminId, tableNumber) {
  return getSavedCustomerProfile(adminId, tableNumber).mobile;
}

export function getSavedCustomerName(adminId, tableNumber) {
  return getSavedCustomerProfile(adminId, tableNumber).name;
}

export function getSavedCustomerProfile(adminId, tableNumber) {
  const key = tableKey(adminId, tableNumber);
  if (!key) return { mobile: '', name: '' };

  const entry = readAll()[key];
  const mobile = entry?.mobile ? String(entry.mobile).trim() : '';
  const name = entry?.name ? String(entry.name).trim() : '';
  return {
    mobile: /^\d{10}$/.test(mobile) ? mobile : '',
    name
  };
}

export function saveCustomerMobileLogin(adminId, tableNumber, mobile, name = '') {
  const key = tableKey(adminId, tableNumber);
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
export function clearCustomerMobileLogin(adminId, tableNumber) {
  const key = tableKey(adminId, tableNumber);
  if (!key) return;
  const all = readAll();
  delete all[key];
  writeAll(all);
}
