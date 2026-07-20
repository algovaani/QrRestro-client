import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Interceptor to add JWT token from localStorage
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor to handle 401 unauthorized
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login';
      }
    }
    if (error.response?.status === 403 && error.response?.data?.code === 'ACCOUNT_DEACTIVATED') {
      const saved = localStorage.getItem('user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          u.isActive = false;
          u.membershipOfferSent = false;
          u.renewalRequested = false;
          localStorage.setItem('user', JSON.stringify(u));
          window.dispatchEvent(new CustomEvent('account-deactivated'));
        } catch { /* ignore */ }
      }
    }
    return Promise.reject(error);
  }
);

export default API;
