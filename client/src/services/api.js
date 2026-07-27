import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

const API_ORIGIN_STORAGE_KEY = 'restaurant_api_origin';

function readStoredApiOrigin() {
  try {
    return sessionStorage.getItem(API_ORIGIN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function storeApiOrigin(origin) {
  if (!origin) return;
  try {
    sessionStorage.setItem(API_ORIGIN_STORAGE_KEY, origin.replace(/\/$/, ''));
  } catch {
    /* ignore */
  }
}

/** Persist API host at startup so bill PDF links work before the first API response */
function bootstrapApiOriginFromEnv() {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiUrl && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
    try {
      storeApiOrigin(new URL(apiUrl).origin);
    } catch {
      /* ignore */
    }
  }

  const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (publicAppUrl && (publicAppUrl.startsWith('http://') || publicAppUrl.startsWith('https://'))) {
    try {
      storeApiOrigin(new URL(publicAppUrl.replace(/\/$/, '')).origin);
    } catch {
      /* ignore */
    }
  }
}

bootstrapApiOriginFromEnv();

/** Origin where /api routes are served (backend host in split deploy) */
export function getApiOrigin() {
  const stored = readStoredApiOrigin();
  if (stored) return stored;

  const explicit = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit.replace(/\/$/, '')).origin;
    } catch {
      return explicit.replace(/\/$/, '');
    }
  }

  const baseURL = API.defaults.baseURL;
  if (typeof baseURL === 'string' && (baseURL.startsWith('http://') || baseURL.startsWith('https://'))) {
    try {
      return new URL(baseURL).origin;
    } catch {
      /* fall through */
    }
  }

  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiUrl && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      /* fall through */
    }
  }

  return window.location.origin;
}

export function rememberApiOrigin(origin) {
  if (!origin) return;
  storeApiOrigin(origin.replace(/\/$/, ''));
}

function captureApiOriginFromResponse(response) {
  const header =
    response?.headers?.['x-api-origin'] ||
    response?.headers?.['X-Api-Origin'];
  if (header) {
    rememberApiOrigin(header);
    return;
  }

  const configBase = response?.config?.baseURL;
  if (typeof configBase === 'string' && configBase.startsWith('http')) {
    try {
      rememberApiOrigin(new URL(configBase).origin);
    } catch {
      /* ignore */
    }
    return;
  }

  const requestUrl = response?.request?.responseURL;
  if (requestUrl) {
    try {
      rememberApiOrigin(new URL(requestUrl).origin);
    } catch {
      /* ignore */
    }
  }
}

// Interceptor to add JWT token (sessionStorage first = branch portal tab)
API.interceptors.request.use((config) => {
  let token = null;
  try {
    token = sessionStorage.getItem('token') || localStorage.getItem('token');
  } catch {
    token = localStorage.getItem('token');
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let browser set multipart boundary — manual Content-Type breaks file uploads
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => Promise.reject(error));

function clearActiveAuthStorage() {
  try {
    if (sessionStorage.getItem('token')) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      return;
    }
  } catch {
    /* ignore */
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function patchActiveUser(mutator) {
  const stores = [];
  try {
    if (sessionStorage.getItem('user')) stores.push(sessionStorage);
  } catch {
    /* ignore */
  }
  if (localStorage.getItem('user') && stores.length === 0) stores.push(localStorage);
  if (stores.length === 0 && localStorage.getItem('user')) stores.push(localStorage);

  for (const store of stores.length ? stores : [localStorage]) {
    const saved = store.getItem('user');
    if (!saved) continue;
    try {
      const u = JSON.parse(saved);
      mutator(u);
      store.setItem('user', JSON.stringify(u));
      return u;
    } catch {
      /* ignore */
    }
  }
  return null;
}

// Response interceptor to handle 401 unauthorized
API.interceptors.response.use(
  (response) => {
    captureApiOriginFromResponse(response);
    return response;
  },
  (error) => {
    if (error.response) {
      captureApiOriginFromResponse(error.response);
    }
    if (error.response && error.response.status === 401) {
      clearActiveAuthStorage();
      const path = window.location.pathname;
      if (
        (path.startsWith('/admin') || path.startsWith('/branch') || path.startsWith('/super-admin'))
        && path !== '/admin/login'
        && path !== '/branch/access'
      ) {
        window.location.href = '/admin/login';
      }
    }
    if (error.response?.status === 403 && error.response?.data?.code === 'MEMBERSHIP_EXPIRED') {
      const data = error.response.data;
      const u = patchActiveUser((user) => {
        user.planStatus = 'Expired';
        user.isExpired = true;
        user.renewalRequested = Boolean(data.renewalRequested);
      });
      if (u) {
        window.dispatchEvent(new CustomEvent('membership-expired', { detail: data }));
        const path = window.location.pathname;
        if (!path.includes('subscription-expired') && !path.includes('/admin/membership')) {
          window.location.href = '/subscription-expired';
        }
      }
    }
    if (error.response?.status === 403 && error.response?.data?.code === 'ACCOUNT_DEACTIVATED') {
      const data = error.response.data;
      const u = patchActiveUser((user) => {
        user.isActive = false;
        user.membershipOfferSent = Boolean(data.membershipOfferSent);
        user.membershipOfferPlanName = data.membershipOfferPlanName || user.membershipOfferPlanName || '';
        user.renewalRequested = Boolean(data.renewalRequested);
      });
      if (u) {
        window.dispatchEvent(new CustomEvent('account-deactivated', {
          detail: {
            membershipOfferSent: u.membershipOfferSent,
            membershipOfferPlanName: u.membershipOfferPlanName,
            renewalRequested: u.renewalRequested
          }
        }));
        const path = window.location.pathname;
        if (!path.includes('subscription-expired') && !path.includes('/admin/membership')) {
          window.location.href = '/subscription-expired';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default API;
