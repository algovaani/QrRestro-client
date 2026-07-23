import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';

const AuthContext = createContext();

const syncUserFromApi = (prev, u) => ({
  ...prev,
  ...u,
  isActive: u.isActive,
  planName: u.planName,
  planStatus: u.planStatus,
  planFeatureKeys: u.planFeatureKeys,
  planFeatures: u.planFeatures,
  isExpired: u.isExpired,
  daysRemaining: u.daysRemaining,
  displayPlanName: u.displayPlanName,
  renewalRequested: u.renewalRequested,
  requestedPlanName: u.requestedPlanName || '',
  membershipOfferSent: u.membershipOfferSent,
  membershipOfferPlanName: u.membershipOfferPlanName || '',
  subscriptionEndsAt: u.subscriptionEndsAt,
  trialEndsAt: u.trialEndsAt
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const onDeactivated = (e) => {
      setUser((prev) => {
        if (!prev) return prev;
        const detail = e.detail || {};
        const updated = {
          ...prev,
          isActive: false,
          membershipOfferSent: detail.membershipOfferSent ?? prev.membershipOfferSent ?? false,
          membershipOfferPlanName: detail.membershipOfferPlanName ?? prev.membershipOfferPlanName ?? '',
          renewalRequested: detail.renewalRequested ?? prev.renewalRequested ?? false
        };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
    };
    const onExpired = (e) => {
      setUser((prev) => {
        if (!prev) return prev;
        const detail = e.detail || {};
        const updated = {
          ...prev,
          planStatus: 'Expired',
          isExpired: true,
          renewalRequested: Boolean(detail.renewalRequested ?? prev.renewalRequested)
        };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
    };
    window.addEventListener('account-deactivated', onDeactivated);
    window.addEventListener('membership-expired', onExpired);
    return () => {
      window.removeEventListener('account-deactivated', onDeactivated);
      window.removeEventListener('membership-expired', onExpired);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      if (!token || !user) {
        if (!cancelled) setAuthReady(true);
        return;
      }

      try {
        const res = await API.get('/auth/me');
        if (!cancelled && res.data.success && res.data.user) {
          setUser((prev) => {
            if (!prev) return prev;
            const updated = syncUserFromApi(prev, res.data.user);
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        if (!cancelled && err.response?.status === 401) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };

    bootstrapAuth();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authReady || !token || !user || user.role === 'SuperAdmin') return;

    API.get('/auth/subscription-status')
      .then((res) => {
        if (!res.data.success || !res.data.user) return;
        const u = res.data.user;
        setUser((prev) => {
          if (!prev) return prev;
          const updated = syncUserFromApi(prev, u);
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
      })
      .catch(() => {});
  }, [authReady, token, user?.role]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      if (res.data.success) {
        setUser(res.data.user);
        setToken(res.data.token);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setAuthReady(true);
        return { success: true, user: res.data.user };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Login failed. Invalid credentials.'
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthReady(true);
  };

  const updateUser = (partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, authReady, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
