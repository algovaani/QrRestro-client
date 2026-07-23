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

// Interceptor to add JWT token from localStorage
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let browser set multipart boundary — manual Content-Type breaks file uploads
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => Promise.reject(error));

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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const path = window.location.pathname;
      if (path.startsWith('/branch')) {
        if (path !== '/branch/login') {
          window.location.href = '/branch/login';
        }
      } else if (path.startsWith('/admin') && path !== '/admin/login') {
        window.location.href = '/admin/login';
      }
    }
    if (error.response?.status === 403 && error.response?.data?.code === 'MEMBERSHIP_EXPIRED') {
      const saved = localStorage.getItem('user');
      const data = error.response.data;
      if (saved) {
        try {
          const u = JSON.parse(saved);
          u.planStatus = 'Expired';
          u.isExpired = true;
          u.renewalRequested = Boolean(data.renewalRequested);
          localStorage.setItem('user', JSON.stringify(u));
          window.dispatchEvent(new CustomEvent('membership-expired', { detail: data }));
          const path = window.location.pathname;
          if (!path.includes('subscription-expired') && !path.includes('/admin/membership')) {
            window.location.href = '/subscription-expired';
          }
        } catch { /* ignore */ }
      }
    }
    if (error.response?.status === 403 && error.response?.data?.code === 'ACCOUNT_DEACTIVATED') {
      const saved = localStorage.getItem('user');
      const data = error.response.data;
      if (saved) {
        try {
          const u = JSON.parse(saved);
          u.isActive = false;
          u.membershipOfferSent = Boolean(data.membershipOfferSent);
          u.membershipOfferPlanName = data.membershipOfferPlanName || u.membershipOfferPlanName || '';
          u.renewalRequested = Boolean(data.renewalRequested);
          localStorage.setItem('user', JSON.stringify(u));
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
        } catch { /* ignore */ }
      }
    }
    return Promise.reject(error);
  }
);

export default API;
