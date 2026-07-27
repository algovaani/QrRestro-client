import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/common/BrandLogo';

/**
 * One-click handoff from restaurant admin → branch portal in a new tab.
 * Auth is stored in sessionStorage so the admin tab keeps its localStorage session.
 */
export default function BranchAccessPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('auth');
        if (!raw) {
          setError('Invalid or expired branch login link.');
          return;
        }

        const parsed = JSON.parse(decodeURIComponent(raw));
        if (!parsed?.token || !parsed?.user || parsed.user.role !== 'BranchAdmin') {
          setError('Invalid branch session.');
          return;
        }

        sessionStorage.setItem('token', parsed.token);
        sessionStorage.setItem('user', JSON.stringify(parsed.user));

        // Full reload so AuthProvider picks sessionStorage (not admin localStorage)
        window.location.replace('/branch/dashboard');
      } catch {
        if (!cancelled) setError('Could not open branch portal. Try again.');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [navigate]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'var(--bg-main, #f8fafc)'
      }}>
        <div style={{
          textAlign: 'center',
          background: '#fff',
          padding: '2rem',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          maxWidth: '360px'
        }}>
          <BrandLogo size={64} style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Branch Login Failed</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/admin/login')}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)'
    }}>
      Opening branch portal…
    </div>
  );
}
