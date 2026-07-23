const STORAGE_KEY = 'customer_phone_by_restaurant';

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

export function getSavedCustomerMobile(adminId) {
  return getSavedCustomerProfile(adminId).mobile;
}

export function getSavedCustomerName(adminId) {
  return getSavedCustomerProfile(adminId).name;
}

export function getSavedCustomerProfile(adminId) {
  if (!adminId) return { mobile: '', name: '' };
  const entry = readAll()[String(adminId)];
  const mobile = entry?.mobile ? String(entry.mobile).trim() : '';
  const name = entry?.name ? String(entry.name).trim() : '';
  return {
    mobile: /^\d{10}$/.test(mobile) ? mobile : '',
    name
  };
}

export function saveCustomerMobileLogin(adminId, mobile, name = '') {
  if (!adminId || !/^\d{10}$/.test(String(mobile).trim())) return;
  const all = readAll();
  const prev = all[String(adminId)] || {};
  all[String(adminId)] = {
    mobile: String(mobile).trim(),
    name: String(name || prev.name || '').trim(),
    savedAt: Date.now()
  };
  writeAll(all);
}

export function clearCustomerMobileLogin(adminId) {
  if (!adminId) return;
  const all = readAll();
  delete all[String(adminId)];
  writeAll(all);
}
