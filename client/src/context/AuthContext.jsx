import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onDeactivated = () => {
      setUser((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          isActive: false,
          membershipOfferSent: false,
          renewalRequested: false
        };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
    };
    window.addEventListener('account-deactivated', onDeactivated);
    return () => window.removeEventListener('account-deactivated', onDeactivated);
  }, []);

  useEffect(() => {
    if (!token || !user || user.role === 'SuperAdmin' || user.isActive === false) return;

    API.get('/auth/subscription-status')
      .then((res) => {
        if (!res.data.success || !res.data.user) return;
        const u = res.data.user;
        setUser((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            isActive: u.isActive,
            planName: u.planName,
            planStatus: u.planStatus,
            isExpired: u.isExpired,
            renewalRequested: u.renewalRequested,
            requestedPlanName: u.requestedPlanName || '',
            membershipOfferSent: u.membershipOfferSent,
            membershipOfferPlanName: u.membershipOfferPlanName || '',
            subscriptionEndsAt: u.subscriptionEndsAt,
            trialEndsAt: u.trialEndsAt
          };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
      })
      .catch(() => {});
  }, [token, user?.isActive, user?.role]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      if (res.data.success) {
        setUser(res.data.user);
        setToken(res.data.token);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
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
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
