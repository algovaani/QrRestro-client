import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPostLoginPath } from '../../utils/adminAccess';
import { LogIn, AlertCircle, UtensilsCrossed } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { user, token, authReady, login, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady || !token || !user) return;
    navigate(getPostLoginPath(user), { replace: true });
  }, [authReady, token, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(email, password);
    if (res && res.success) {
      navigate(getPostLoginPath(res.user));
    } else {
      setError(res?.message || 'Invalid email or password');
    }
  };

  return (
    <div className="auth-login-page">
      <div className="auth-login-card">
        <div className="auth-login-brand">
          <div className="auth-login-icon">
            <UtensilsCrossed size={30} strokeWidth={2.25} />
          </div>
          <div className="auth-login-brand-name">Royal Spice</div>
          <h1 className="auth-login-title">Welcome back</h1>
          <p className="auth-login-subtitle">
            Sign in with your email and password.
          </p>
        </div>

        {error && (
          <div className="auth-login-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-login-form">
          <div className="auth-login-field">
            <label htmlFor="admin-email">Email Address</label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
            />
          </div>

          <div className="auth-login-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary auth-login-submit"
          >
            <LogIn size={18} />
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
