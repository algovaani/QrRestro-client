import React, { useEffect, useState } from 'react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Plus,
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Trash2,
  Edit2,
  Search,
  CreditCard,
  BellRing,
  Layers,
  Check,
  Eye,
  EyeOff,
  Copy,
  Key,
  Sparkles,
  QrCode,
  Send,
  XCircle,
  Phone,
  Menu,
  X,
  Settings
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import NotificationToasts from '../../components/common/NotificationToasts';
import AdminNotificationBell from '../../components/common/AdminNotificationBell';
import UpiQrDisplay from '../../components/common/UpiQrDisplay';
import { resolveUploadUrl } from '../../utils/uploadUrl';

export default function SuperAdminDashboard() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const { socket, notifications, removeNotification, isConnected } = useSocket();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    totalAdmins: 0,
    activeAdmins: 0,
    trialingAdmins: 0,
    expiredAdmins: 0,
    renewalRequestsCount: 0
  });

  const [admins, setAdmins] = useState([]);
  const [plans, setPlans] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('admins'); // 'admins', 'renewals', 'plans'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });

  // State to toggle password visibility per admin ID
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Add Admin Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    restaurantName: '',
    email: '',
    password: '',
    planName: '5-Day Free Trial'
  });

  // Edit Admin Modal State
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    restaurantName: '',
    email: '',
    password: '',
    planName: 'Monthly Plan'
  });

  // Renew Plan Modal State
  const [renewingAdmin, setRenewingAdmin] = useState(null);
  const [renewPlanName, setRenewPlanName] = useState('Monthly Plan');
  const [renewDays, setRenewDays] = useState(30);
  const [rejectingAdmin, setRejectingAdmin] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Plan Management Modal State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    price: 999,
    durationDays: 30,
    description: '',
    features: 'Unlimited Table QR Scans, Real-Time KDS, Dynamic UPI QR, WhatsApp Invoice',
    status: 'Active',
    upiId: ''
  });
  const [modalError, setModalError] = useState('');

  const [sendingOfferAdmin, setSendingOfferAdmin] = useState(null);
  const [offerPlanName, setOfferPlanName] = useState('Monthly Plan');

  const [supportNumber, setSupportNumber] = useState('');
  const [supportSaving, setSupportSaving] = useState(false);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountTab, setAccountTab] = useState('email');
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    currentPassword: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchSuperAdminData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSuperAdminData(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onRenewalRequest = (data) => {
      fetchSuperAdminData();
      setActiveTab('renewals');
      const name = data?.restaurantName || data?.adminName || 'Restaurant admin';
      const plan = data?.requestedPlanName ? ` (${data.requestedPlanName})` : '';
      showToast('success', `📋 ${name} submitted a membership renewal request${plan} — payment screenshot attached!`);
    };

    socket.on('membership_renewal_request', onRenewalRequest);
    return () => socket.off('membership_renewal_request', onRenewalRequest);
  }, [socket]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: '', message: '' }), 4000);
  };

  const fetchSuperAdminData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, adminsRes, plansRes, platformRes] = await Promise.all([
        API.get('/super-admin/stats'),
        API.get('/super-admin/admins'),
        API.get('/super-admin/plans'),
        API.get('/super-admin/platform-settings').catch(() => null)
      ]);

      if (statsRes.data.success) setStats(statsRes.data.stats);
      if (adminsRes.data.success) setAdmins(adminsRes.data.admins);
      if (plansRes.data.success) setPlans(plansRes.data.plans);
      if (platformRes?.data?.success) {
        setSupportNumber(platformRes.data.settings?.supportNumber || '');
      }
    } catch (err) {
      console.error('Super Admin fetch error:', err);
      if (!silent) {
        showToast('error', err.response?.data?.message || 'Failed to load Super Admin data');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const togglePasswordVisibility = (adminId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [adminId]: !prev[adminId]
    }));
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  const handleSaveSupportNumber = async (e) => {
    e.preventDefault();
    setSupportSaving(true);
    try {
      const res = await API.put('/super-admin/platform-settings', { supportNumber });
      if (res.data.success) {
        setSupportNumber(res.data.settings?.supportNumber || '');
        showToast('success', res.data.message || 'Support number saved');
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to save support number');
    } finally {
      setSupportSaving(false);
    }
  };

  // --- ADMIN ACCOUNT ACTIONS ---
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setModalError('');
    setActionLoading(true);
    try {
      const res = await API.post('/super-admin/admins', newAdmin);
      if (res.data.success) {
        setShowAddModal(false);
        setNewAdmin({ name: '', restaurantName: '', email: '', password: '', planName: plans[0]?.name || '5-Day Free Trial' });
        showToast('success', res.data.message || 'Admin account created successfully');
        fetchSuperAdminData();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error creating Restaurant Admin account');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditAdmin = (admin) => {
    setEditingAdmin(admin);
    setEditForm({
      name: admin.name,
      restaurantName: admin.restaurantName || '',
      email: admin.email,
      password: admin.rawPassword || '',
      planName: admin.planName || 'Monthly Plan'
    });
    setModalError('');
  };

  const handleUpdateAdminSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setActionLoading(true);
    try {
      const res = await API.put(`/super-admin/admins/${editingAdmin._id}`, editForm);
      if (res.data.success) {
        setEditingAdmin(null);
        showToast('success', res.data.message || 'Admin updated successfully');
        fetchSuperAdminData();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error updating admin account');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (admin) => {
    const adminId = admin._id;
    if (admin.isActive) {
      const confirmed = window.confirm(
        `Deactivate "${admin.restaurantName || admin.name}"?\n\nThe admin will see a membership renewal popup and lose dashboard access.`
      );
      if (!confirmed) return;
    }

    setActionLoading(true);
    try {
      const res = await API.patch(`/super-admin/admins/${adminId}/toggle-status`);
      if (res.data.success) {
        fetchSuperAdminData();
        showToast(
          'success',
          !admin.isActive
            ? 'Admin account activated.'
            : 'Admin deactivated. They will see the membership renewal popup.'
        );
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Error updating account status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRenew = async (adminId) => {
    setActionLoading(true);
    try {
      const res = await API.patch(`/super-admin/admins/${adminId}/renew`, {
        planName: renewPlanName,
        extendDays: Number(renewDays)
      });
      if (res.data.success) {
        setRenewingAdmin(null);
        showToast('success', res.data.message || 'Membership renewed & account reactivated!');
        fetchSuperAdminData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Error renewing membership');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRenew = async () => {
    if (!rejectingAdmin) return;
    setActionLoading(true);
    try {
      const res = await API.patch(`/super-admin/admins/${rejectingAdmin._id}/reject-renewal`, {
        reason: rejectReason.trim() || undefined
      });
      if (res.data.success) {
        setRejectingAdmin(null);
        setRejectReason('');
        setRenewingAdmin(null);
        showToast('success', res.data.message || 'Renewal request rejected.');
        fetchSuperAdminData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Error rejecting renewal request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateAdmin = async (admin) => {
    setRenewingAdmin(admin);
    setRenewPlanName(admin.planName || 'Monthly Plan');
    const matched = plans.find((p) => p.name === admin.planName);
    setRenewDays(matched?.durationDays || 30);
  };

  const handleOpenSendOffer = (admin) => {
    setSendingOfferAdmin(admin);
    setOfferPlanName(admin.membershipOfferPlanName || admin.planName || plans[0]?.name || 'Monthly Plan');
    setModalError('');
  };

  const handleSendMembershipOffer = async () => {
    if (!sendingOfferAdmin) return;
    setActionLoading(true);
    try {
      const res = await API.patch(`/super-admin/admins/${sendingOfferAdmin._id}/send-membership-offer`, {
        planName: offerPlanName
      });
      if (res.data.success) {
        setSendingOfferAdmin(null);
        showToast('success', res.data.message || 'Membership offer sent!');
        fetchSuperAdminData();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error sending membership offer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!window.confirm('Are you sure you want to delete this Restaurant Admin account?')) return;
    setActionLoading(true);
    try {
      const res = await API.delete(`/super-admin/admins/${adminId}`);
      showToast('success', res.data?.message || 'Admin account deleted successfully');
      fetchSuperAdminData();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Error deleting account');
    } finally {
      setActionLoading(false);
    }
  };

  // --- PLAN MANAGEMENT ACTIONS ---
  const handleOpenAddPlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      price: 999,
      durationDays: 30,
      description: 'Full featured membership plan for dining outlets',
      features: 'Unlimited Table Scans, Real-Time Kitchen KDS, Dynamic UPI QR, WhatsApp Tax Invoice, Sales Reports',
      status: 'Active',
      upiId: ''
    });
    setModalError('');
    setShowPlanModal(true);
  };

  const handleOpenEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      description: plan.description || '',
      features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
      status: plan.status || 'Active',
      upiId: plan.upiId || ''
    });
    setModalError('');
    setShowPlanModal(true);
  };

  const handleSavePlanSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setActionLoading(true);
    try {
      const payload = {
        name: planForm.name,
        price: planForm.price,
        durationDays: planForm.durationDays,
        description: planForm.description || '',
        features: planForm.features || '',
        status: planForm.status || 'Active',
        upiId: planForm.upiId || ''
      };

      if (editingPlan) {
        const res = await API.put(`/super-admin/plans/${editingPlan._id}`, payload);
        if (res.data.success) {
          setShowPlanModal(false);
          showToast('success', res.data.message || 'Plan updated successfully');
          fetchSuperAdminData();
        }
      } else {
        const res = await API.post('/super-admin/plans', payload);
        if (res.data.success) {
          setShowPlanModal(false);
          showToast('success', res.data.message || 'Plan created successfully');
          fetchSuperAdminData();
        }
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error saving membership plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this Membership Plan?')) return;
    setActionLoading(true);
    try {
      const res = await API.delete(`/super-admin/plans/${planId}`);
      showToast('success', res.data?.message || 'Plan deleted successfully');
      fetchSuperAdminData();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Error deleting membership plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const openAccountModal = () => {
    setAccountTab('email');
    setEmailForm({ newEmail: '', currentPassword: '' });
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setAccountError('');
    setAccountSuccess('');
    setShowEmailPassword(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowAccountModal(true);
  };

  const handleChangeEmailSubmit = async (e) => {
    e.preventDefault();
    setAccountError('');
    setAccountSuccess('');

    const newEmail = emailForm.newEmail.trim();
    if (!newEmail) {
      setAccountError('Please enter a new email address');
      return;
    }

    if (!emailForm.currentPassword) {
      setAccountError('Please enter your current password');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await API.put('/auth/change-email', {
        newEmail,
        currentPassword: emailForm.currentPassword
      });

      if (res.data.success) {
        updateUser({ email: res.data.email });
        setAccountSuccess('Email updated successfully');
        setEmailForm({ newEmail: '', currentPassword: '' });
        setTimeout(() => setAccountSuccess(''), 2000);
      }
    } catch (err) {
      setAccountError(err.response?.data?.message || 'Failed to change email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setAccountError('');
    setAccountSuccess('');

    if (!passwordForm.currentPassword) {
      setAccountError('Please enter your current password');
      return;
    }

    if (!passwordForm.newPassword) {
      setAccountError('Please enter a new password');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setAccountError('New password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setAccountError('New password and confirm password do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await API.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      if (res.data.success) {
        setAccountSuccess('Password changed successfully');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setAccountSuccess(''), 2000);
      }
    } catch (err) {
      setAccountError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const filteredAdmins = admins.filter(admin => {
    const query = searchTerm.toLowerCase();
    return (
      admin.name.toLowerCase().includes(query) ||
      (admin.restaurantName && admin.restaurantName.toLowerCase().includes(query)) ||
      admin.email.toLowerCase().includes(query) ||
      admin.planName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="admin-layout">
      {sidebarOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* SUPER ADMIN SIDEBAR */}
      <div className={`admin-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-brand-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 style={{ color: '#fff' }}>SaaS Master</h3>
            <span>Super Admin Portal</span>
          </div>
          <button type="button" className="admin-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          <button
            onClick={() => { setActiveTab('admins'); setSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === 'admins' ? 'active' : ''}`}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <Users size={18} />
            <span>Restaurant Admins</span>
          </button>

          <button
            onClick={() => { setActiveTab('renewals'); setSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === 'renewals' ? 'active' : ''}`}
            style={{ width: '100%', textAlign: 'left', position: 'relative' }}
          >
            <CreditCard size={18} />
            <span>Plan Renew Requests</span>
            {stats.renewalRequestsCount > 0 && (
              <span style={{ position: 'absolute', right: '12px', background: 'var(--primary)', color: '#fff', borderRadius: '99px', fontSize: '0.65rem', padding: '0.1rem 0.45rem', fontWeight: '800' }}>
                {stats.renewalRequestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('plans'); setSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === 'plans' ? 'active' : ''}`}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <Layers size={18} />
            <span>Membership Plans ({plans.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            className={`sidebar-link ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <Settings size={18} />
            <span>Platform Settings</span>
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{user?.name || 'Super Admin'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>

          <button
            onClick={openAccountModal}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}
          >
            <Key size={16} />
            <span>Account Settings</span>
          </button>

          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', color: 'var(--danger)' }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="admin-main">
        
        {/* Header with Prominent Action Buttons */}
        <header className="admin-header">
          <div className="admin-header-start">
            <button type="button" className="admin-mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <h2 className="admin-header-title">Super Admin Control Center</h2>
          </div>

          <div className="admin-header-actions">
            <div
              className={`admin-header-sync${isConnected ? ' is-connected' : ' is-disconnected'}`}
              title={isConnected ? 'Live notifications connected' : 'Reconnecting…'}
            >
              <BellRing size={16} />
              <span>{isConnected ? 'Live' : 'Offline'}</span>
            </div>

            <AdminNotificationBell
              onNavigate={(path) => {
                if (path.includes('super-admin')) setActiveTab('renewals');
              }}
            />

            <button onClick={() => fetchSuperAdminData()} disabled={loading || actionLoading} className="btn btn-secondary btn-sm" title="Refresh Data">
              <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> <span className="btn-label">Refresh</span>
            </button>

            <button onClick={handleOpenAddPlan} className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: '700' }}>
              <Sparkles size={16} /> <span className="btn-label">Add Plan</span>
            </button>

            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
              <Plus size={16} /> <span className="btn-label">Create Admin</span>
            </button>
          </div>
        </header>

        <div className="admin-content">

          {stats.renewalRequestsCount > 0 && (
            <div
              role="alert"
              onClick={() => setActiveTab('renewals')}
              style={{
                marginBottom: '1rem',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: '#fff7ed',
                border: '1px solid #fdba74',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontWeight: '700',
                color: '#9a3412'
              }}
            >
              <BellRing size={20} />
              {stats.renewalRequestsCount} admin(s) submitted membership renewal requests — click to review
            </div>
          )}

          {toast.message && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '600',
              background: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: toast.type === 'error' ? '#991b1b' : '#166534',
              border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`
            }}>
              {toast.message}
            </div>
          )}
          
          {/* STATS GRID */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
            <div className="stat-card" onClick={() => setActiveTab('admins')} style={{ cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Total Admins</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.2rem' }}>{stats.totalAdmins}</h3>
              </div>
              <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                <Users size={22} />
              </div>
            </div>

            <div className="stat-card" onClick={() => setActiveTab('admins')} style={{ cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Active Accounts</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.2rem', color: '#15803d' }}>{stats.activeAdmins}</h3>
              </div>
              <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
                <UserCheck size={22} />
              </div>
            </div>

            <div className="stat-card" onClick={() => setActiveTab('admins')} style={{ cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>5-Day Free Trials</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.2rem', color: 'var(--primary)' }}>{stats.trialingAdmins}</h3>
              </div>
              <div className="stat-icon" style={{ background: '#fff0e6', color: 'var(--primary)' }}>
                <Clock size={22} />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('renewals')}
              className="stat-card"
              style={{ cursor: 'pointer' }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Renewal Requests</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.2rem', color: '#dc2626' }}>{stats.renewalRequestsCount}</h3>
                <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: '700' }}>Review Requests →</span>
              </div>
              <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <BellRing size={22} />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('plans')}
              className="stat-card"
              style={{ cursor: 'pointer' }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Active Membership Plans</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '0.2rem', color: '#0284c7' }}>{plans.length}</h3>
                <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: '700' }}>Manage Plans →</span>
              </div>
              <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <Layers size={22} />
              </div>
            </div>
          </div>

          {/* TAB 1: ADMINS DATATABLE WITH PASSWORD CREDENTIALS VISIBILITY */}
          {activeTab === 'admins' && (
            <div className="admin-panel">
              <div className="admin-panel--padded admin-toolbar" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="admin-toolbar-search">
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search restaurant name, admin email, plan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', paddingLeft: '38px' }}
                  />
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  Showing {filteredAdmins.length} Admin Accounts
                </div>
              </div>

              <div className="admin-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  <tr>
                    <th style={{ padding: '0.85rem 1rem' }}>RESTAURANT & ADMIN</th>
                    <th style={{ padding: '0.85rem 1rem' }}>EMAIL & LOGIN PASSWORD</th>
                    <th style={{ padding: '0.85rem 1rem' }}>MEMBERSHIP PLAN</th>
                    <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                    <th style={{ padding: '0.85rem 1rem' }}>DAYS LEFT</th>
                    <th style={{ padding: '0.85rem 1rem' }}>LOGIN ACCESS</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading admin accounts...
                      </td>
                    </tr>
                  ) : filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No admin accounts found. <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => setShowAddModal(true)}>+ Create Admin</button>
                      </td>
                    </tr>
                  ) : filteredAdmins.map(admin => {
                    const isPassVisible = visiblePasswords[admin._id];
                    const passText = admin.rawPassword || 'admin123';

                    return (
                      <tr key={admin._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '0.95rem' }}>{admin.restaurantName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Admin: {admin.name}</div>
                        </td>

                        {/* EMAIL & TOGGLEABLE LOGIN PASSWORD */}
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: '700', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{admin.email}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(admin.email, 'Email')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                              title="Copy Email"
                            >
                              <Copy size={13} />
                            </button>
                          </div>

                          <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', width: 'fit-content' }}>
                            <Key size={13} color="var(--primary)" />
                            <span style={{ fontFamily: 'monospace', fontWeight: '700', letterSpacing: isPassVisible ? 'normal' : '2px', color: isPassVisible ? 'var(--danger)' : 'var(--text-muted)' }}>
                              {isPassVisible ? passText : '••••••••'}
                            </span>

                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(admin._id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--secondary)' }}
                              title={isPassVisible ? 'Hide Password' : 'Show Password'}
                            >
                              {isPassVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => copyToClipboard(passText, 'Password')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                              title="Copy Password"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <span style={{ fontWeight: '700', color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                            {admin.displayPlanName || admin.planName}
                          </span>
                          {admin.renewalRequested && (
                            <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: '800', marginTop: '0.2rem' }}>
                              ⚡ Renewal Requested
                            </div>
                          )}
                          {admin.membershipOfferSent && !admin.renewalRequested && (
                            <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: '800', marginTop: '0.2rem' }}>
                              ✉ Offer Sent
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          {!admin.isActive ? (
                            <span className="badge badge-cancelled">Deactivated</span>
                          ) : admin.planStatus === 'Expired' ? (
                            <span className="badge badge-cancelled">Expired</span>
                          ) : admin.planStatus === 'Trialing' ? (
                            <span className="badge badge-preparing">5-Day Trial</span>
                          ) : (
                            <span className="badge badge-completed">Active</span>
                          )}
                        </td>

                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: '800', color: admin.daysRemaining <= 3 ? 'var(--danger)' : 'var(--secondary)' }}>
                            {admin.daysRemaining > 0 ? `${admin.daysRemaining} days left` : 'Expired'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Ends: {admin.subscriptionEndsAt
                              ? new Date(admin.subscriptionEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                              : new Date(admin.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(admin)}
                            disabled={actionLoading}
                            className={`btn btn-sm ${admin.isActive ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                            title={admin.isActive ? 'Deactivate admin — membership popup will appear' : 'Reactivate admin account'}
                          >
                            {admin.isActive ? <UserX size={14} color="var(--danger)" /> : <UserCheck size={14} />}
                            <span>{admin.isActive ? 'deactivate' : 'Activate'}</span>
                          </button>
                        </td>

                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {(admin.planStatus === 'Expired' || admin.daysRemaining <= 0) && (
                              <button
                                type="button"
                                onClick={() => handleReactivateAdmin(admin)}
                                disabled={actionLoading}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: '#10b981' }}
                                title="Recharge & Reactivate Account"
                              >
                                <CheckCircle2 size={14} /> Reactivate
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenSendOffer(admin)}
                              disabled={actionLoading}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: '#8b5cf6' }}
                              title="Send Membership Offer to Admin"
                            >
                              <CreditCard size={14} /> Send Offer
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRenewingAdmin(admin);
                                setRenewPlanName(admin.planName || plans[0]?.name || 'Monthly Plan');
                                const matched = plans.find((p) => p.name === admin.planName);
                                setRenewDays(matched?.durationDays || 30);
                              }}
                              disabled={actionLoading}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: '#0284c7' }}
                              title="Renew Membership Plan"
                            >
                              <Calendar size={14} /> Renew
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditAdmin(admin)}
                              disabled={actionLoading}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.35rem 0.5rem' }}
                              title="Edit Admin Account"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteAdmin(admin._id)}
                              disabled={actionLoading}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.35rem 0.5rem' }}
                              title="Delete Admin Account"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* TAB 2: RENEWAL REQUESTS */}
          {activeTab === 'renewals' && (
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.35rem', color: 'var(--secondary)' }}>
                Pending Membership Requests
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Admin submitted payment — verify and activate membership
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {admins.filter(a => a.renewalRequested).map(admin => {
                  const reqPlan = plans.find(p => p.name === admin.requestedPlanName);
                  return (
                    <div key={admin._id} className="membership-sa-request-card">
                      <div className="membership-sa-request-main">
                        <div className="membership-sa-request-badge">
                          <BellRing size={14} /> New Request
                        </div>
                        <h4>{admin.restaurantName}</h4>
                        <p className="membership-sa-request-sub">
                          {admin.name} • {admin.email}
                        </p>
                        <div className="membership-sa-request-details">
                          <span>Current: <strong>{admin.planName}</strong></span>
                          <span>Requested: <strong style={{ color: 'var(--primary)' }}>{admin.requestedPlanName || 'Renewal'}</strong></span>
                          {reqPlan && <span>Amount: <strong>₹{reqPlan.price}</strong></span>}
                          <span>Date: {admin.renewalRequestDate ? new Date(admin.renewalRequestDate).toLocaleString('en-IN') : 'Recently'}</span>
                        </div>
                        {reqPlan?.features?.length > 0 && (
                          <div className="membership-sa-request-features">
                            {reqPlan.features.slice(0, 3).map((f, i) => (
                              <span key={i}>✓ {f}</span>
                            ))}
                          </div>
                        )}

                        {admin.renewalPaymentProof && (
                          <div className="membership-sa-payment-proof">
                            <span className="membership-sa-proof-label">Payment Screenshot:</span>
                            <a
                              href={resolveUploadUrl(admin.renewalPaymentProof)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={resolveUploadUrl(admin.renewalPaymentProof)}
                                alt="Payment proof"
                                className="membership-sa-proof-thumb"
                              />
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="membership-sa-request-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setRenewingAdmin(admin);
                            const planName = admin.requestedPlanName || admin.planName || plans[0]?.name || 'Monthly Plan';
                            setRenewPlanName(planName);
                            const matched = plans.find((p) => p.name === planName);
                            setRenewDays(matched?.durationDays || 30);
                          }}
                          disabled={actionLoading}
                          className="btn btn-primary"
                          style={{ background: '#10b981', flex: 1 }}
                        >
                          <CheckCircle2 size={16} />
                          Approve & Activate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingAdmin(admin);
                            setRejectReason('');
                          }}
                          disabled={actionLoading}
                          className="btn btn-secondary"
                          style={{ color: 'var(--danger)', borderColor: '#fecaca', flex: 1 }}
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}

                {admins.filter(a => a.renewalRequested).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <CreditCard size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                    No pending membership requests.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MEMBERSHIP PLANS MANAGEMENT */}
          {activeTab === 'plans' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--secondary)' }}>Membership Plans Package Menu</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Create, edit, or delete SaaS subscription pricing plans for restaurants</span>
                </div>

                <button onClick={handleOpenAddPlan} className="btn btn-primary btn-sm">
                  <Plus size={16} /> + Add New Membership Plan
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {plans.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px dashed var(--border)' }}>
                    <Layers size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                    No membership plans yet.
                    <button type="button" onClick={handleOpenAddPlan} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                      <Plus size={14} /> Add First Plan
                    </button>
                  </div>
                )}
                {plans.map(plan => (
                  <div key={plan._id} style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid var(--border)', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                            {plan.durationDays} Days Duration
                          </span>
                          <h4 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--secondary)', marginTop: '0.35rem' }}>
                            {plan.name}
                          </h4>
                        </div>

                        <span className={`badge ${plan.status === 'Active' ? 'badge-completed' : 'badge-cancelled'}`}>
                          {plan.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '0.75rem' }}>
                        {plan.price === 0 ? 'FREE' : `₹${plan.price}`}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}> / {plan.durationDays} Days</span>
                      </div>

                      {plan.description && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
                          {plan.description}
                        </p>
                      )}

                      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.85rem', marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                          Included Features:
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {(plan.features || []).map((feat, idx) => (
                            <li key={idx} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary)' }}>
                              <Check size={14} color="#10b981" /> {feat}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {plan.upiId && (
                        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '0.75rem', marginBottom: '1rem', textAlign: 'center', border: '1px dashed var(--border)' }}>
                          <UpiQrDisplay
                            upiId={plan.upiId}
                            payeeName={plan.name}
                            amount={plan.price}
                            note={`Membership ${plan.name}`}
                            size={120}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                            UPI: <strong>{plan.upiId}</strong>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700', marginTop: '0.25rem' }}>Auto QR from UPI ID</div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditPlan(plan)}
                        disabled={actionLoading}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Edit2 size={14} /> Edit Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(plan._id)}
                        disabled={actionLoading}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.4rem 0.65rem' }}
                        title="Delete Plan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PLATFORM SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '560px' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--secondary)' }}>Platform Settings</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Support number shown to restaurant admins on the membership purchase page
                </span>
              </div>

              <form
                onSubmit={handleSaveSupportNumber}
                style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  border: '1px solid var(--border)',
                  padding: '1.5rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}
              >
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                  <Phone size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                  Support Mobile Number
                </label>
                <input
                  type="tel"
                  value={supportNumber}
                  onChange={(e) => setSupportNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    fontSize: '1rem',
                    marginBottom: '0.5rem'
                  }}
                />
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Admins will see this number when buying or renewing membership. They can call or WhatsApp for help.
                </p>
                <button type="submit" className="btn btn-primary" disabled={supportSaving}>
                  {supportSaving ? 'Saving...' : 'Save Support Number'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* CREATE NEW ADMIN MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setModalError(''); }}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1rem' }}>
              Create New Restaurant Admin
            </h3>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Admin Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Restaurant Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grand Spice Restaurant"
                  value={newAdmin.restaurantName}
                  onChange={(e) => setNewAdmin({ ...newAdmin, restaurantName: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="admin@restaurant.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Login Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                  Assign Initial Membership Plan *
                </label>
                <select
                  value={newAdmin.planName}
                  onChange={(e) => setNewAdmin({ ...newAdmin, planName: e.target.value })}
                  style={{ width: '100%', fontWeight: '700', color: 'var(--primary)' }}
                >
                  {plans.length > 0 ? plans.map(p => (
                    <option key={p._id} value={p.name}>
                      {p.name} ({p.durationDays} Days - {p.price === 0 ? 'FREE' : `₹${p.price}`})
                    </option>
                  )) : (
                    <option value="5-Day Free Trial">5-Day Free Trial (5 Days - FREE)</option>
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary">
                  {actionLoading ? 'Creating...' : 'Create Admin Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMIN MODAL */}
      {editingAdmin && (
        <div className="modal-overlay" onClick={() => { setEditingAdmin(null); setModalError(''); }}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
              Edit Admin: {editingAdmin.restaurantName}
            </h3>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Admin Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Restaurant Name</label>
                <input
                  type="text"
                  required
                  value={editForm.restaurantName}
                  onChange={(e) => setEditForm({ ...editForm, restaurantName: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Email Address</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                  Update Membership Plan
                </label>
                <select
                  value={editForm.planName}
                  onChange={(e) => setEditForm({ ...editForm, planName: e.target.value })}
                  style={{ width: '100%', fontWeight: '700', color: 'var(--primary)' }}
                >
                  {plans.map(p => (
                    <option key={p._id} value={p.name}>
                      {p.name} ({p.durationDays} Days - {p.price === 0 ? 'FREE' : `₹${p.price}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Login Password (Super Admin View / Change)</label>
                <input
                  type="text"
                  placeholder="Enter new password if changing..."
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  style={{ width: '100%', fontFamily: 'monospace', fontWeight: '700' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditingAdmin(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary">
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEND MEMBERSHIP OFFER MODAL */}
      {sendingOfferAdmin && (
        <div className="modal-overlay" onClick={() => { setSendingOfferAdmin(null); setModalError(''); }}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.5rem' }}>
              Send Membership Offer
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              <strong>{sendingOfferAdmin.restaurantName}</strong> ({sendingOfferAdmin.email}) ke admin panel me
              <strong> Buy / Renew Membership</strong> option dikhega.
            </p>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                Membership Plan Offer
              </label>
              <select
                value={offerPlanName}
                onChange={(e) => setOfferPlanName(e.target.value)}
                style={{ width: '100%', fontWeight: '700', color: 'var(--primary)' }}
              >
                {plans.filter((p) => p.status === 'Active').map((p) => (
                  <option key={p._id} value={p.name}>
                    {p.name} ({p.durationDays} Days — {p.price === 0 ? 'FREE' : `₹${p.price}`})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => setSendingOfferAdmin(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" disabled={actionLoading} onClick={handleSendMembershipOffer} className="btn btn-primary" style={{ background: '#8b5cf6' }}>
                <Send size={16} /> {actionLoading ? 'Sending...' : 'Send Offer to Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENEW MEMBERSHIP MODAL */}
      {renewingAdmin && (
        <div className="modal-overlay" onClick={() => setRenewingAdmin(null)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.5rem' }}>
              {renewingAdmin?.planStatus === 'Expired' || renewingAdmin?.daysRemaining <= 0
                ? `Reactivate ${renewingAdmin.restaurantName}`
                : `Renew Plan for ${renewingAdmin.restaurantName}`}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {renewingAdmin?.renewalRequested && renewingAdmin?.requestedPlanName ? (
                <>Admin requested the <strong>{renewingAdmin.requestedPlanName}</strong> plan.</>
              ) : (
                <>Extend membership & turn dashboard back ON for {renewingAdmin.name} ({renewingAdmin.email}).</>
              )}
            </p>

            {renewingAdmin?.renewalPaymentProof && (
              <div className="membership-sa-modal-proof">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                  Payment Screenshot
                </label>
                <a
                  href={resolveUploadUrl(renewingAdmin.renewalPaymentProof)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={resolveUploadUrl(renewingAdmin.renewalPaymentProof)}
                    alt="Payment proof"
                    className="membership-sa-proof-full"
                  />
                </a>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Select Membership Plan</label>
                <select
                  value={renewPlanName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setRenewPlanName(name);
                    const matched = plans.find((p) => p.name === name);
                    if (matched) setRenewDays(matched.durationDays);
                  }}
                  style={{ width: '100%', fontWeight: '700', color: 'var(--primary)' }}
                >
                  {plans.map(p => (
                    <option key={p._id} value={p.name}>
                      {p.name} ({p.durationDays} Days - {p.price === 0 ? 'FREE' : `₹${p.price}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Extend Access Days</label>
                <input
                  type="number"
                  value={renewDays}
                  onChange={(e) => setRenewDays(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setRenewingAdmin(null)} className="btn btn-secondary">
                Cancel
              </button>
              {renewingAdmin?.renewalRequested && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    setRejectingAdmin(renewingAdmin);
                    setRejectReason('');
                  }}
                  className="btn btn-secondary"
                  style={{ color: 'var(--danger)' }}
                >
                  <XCircle size={16} /> Reject
                </button>
              )}
              <button
                type="button"
                disabled={actionLoading || !renewDays || Number(renewDays) <= 0}
                onClick={() => handleApproveRenew(renewingAdmin._id)}
                className="btn btn-primary"
              >
                {actionLoading
                  ? 'Processing...'
                  : renewingAdmin?.planStatus === 'Expired' || renewingAdmin?.daysRemaining <= 0
                    ? 'Confirm Recharge & Reactivate'
                    : 'Confirm Membership Renewal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT RENEWAL MODAL */}
      {rejectingAdmin && (
        <div className="modal-overlay" onClick={() => setRejectingAdmin(null)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--danger)' }}>
              Reject Renewal Request
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Reject membership request for <strong>{rejectingAdmin.restaurantName}</strong>?
              The admin will see the reason and can upload a new screenshot.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                Rejection Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incorrect payment amount, screenshot not clear..."
                rows={3}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => setRejectingAdmin(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRejectRenew}
                className="btn btn-primary"
                style={{ background: 'var(--danger)' }}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MEMBERSHIP PLAN MODAL */}
      {showPlanModal && (
        <div className="modal-overlay" onClick={() => { setShowPlanModal(false); setModalError(''); }}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1rem' }}>
              {editingPlan ? `Edit Plan: ${editingPlan.name}` : '✨ Create New Membership Plan'}
            </h3>

            {modalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSavePlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Plan Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starter 30-Day Plan, Half-Year Plan, Annual Gold"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Price (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 999"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Duration (Days) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 30"
                    value={planForm.durationDays}
                    onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Plan Description</label>
                <input
                  type="text"
                  placeholder="e.g. Full-featured membership plan for dining outlets"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Included Features (Comma Separated)</label>
                <textarea
                  rows="3"
                  placeholder="Unlimited QR Scans, KDS Display, WhatsApp Tax Receipt, UPI QR Code"
                  value={planForm.features}
                  onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>Status</label>
                <select
                  value={planForm.status}
                  onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>UPI ID (optional — for recharge QR)</label>
                <input
                  type="text"
                  placeholder="e.g. restaurant@upi"
                  value={planForm.upiId}
                  onChange={(e) => setPlanForm({ ...planForm, upiId: e.target.value })}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  QR code will be generated automatically from the UPI ID and plan price.
                </p>
              </div>

              {planForm.upiId && (
                <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                  <UpiQrDisplay
                    upiId={planForm.upiId}
                    payeeName={planForm.name || 'Membership'}
                    amount={planForm.price || 0}
                    note={planForm.name ? `Membership ${planForm.name}` : 'Membership'}
                    size={140}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowPlanModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary">
                  {actionLoading ? 'Saving...' : (editingPlan ? 'Update Plan' : 'Save Membership Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.25rem' }}>
                  Account Settings
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Update your Super Admin login details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="btn btn-secondary btn-sm"
                style={{ minWidth: 'auto', padding: '0.35rem 0.6rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '0.35rem', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => { setAccountTab('email'); setAccountError(''); setAccountSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  background: accountTab === 'email' ? '#ffffff' : 'transparent',
                  color: accountTab === 'email' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: accountTab === 'email' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Change Email
              </button>
              <button
                type="button"
                onClick={() => { setAccountTab('password'); setAccountError(''); setAccountSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  background: accountTab === 'password' ? '#ffffff' : 'transparent',
                  color: accountTab === 'password' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: accountTab === 'password' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Change Password
              </button>
            </div>

            {accountError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '0.85rem' }}>
                {accountError}
              </div>
            )}

            {accountSuccess && (
              <div style={{ background: '#dcfce7', color: '#166534', padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '0.85rem' }}>
                {accountSuccess}
              </div>
            )}

            {accountTab === 'email' ? (
              <form onSubmit={handleChangeEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                    Current Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    style={{ width: '100%', background: '#f8fafc', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                    New Email
                  </label>
                  <input
                    type="email"
                    placeholder="Enter new Gmail / email address"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                    Current Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showEmailPassword ? 'text' : 'password'}
                      placeholder="Enter current password to verify"
                      value={emailForm.currentPassword}
                      onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                      style={{ width: '100%', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showEmailPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button type="button" onClick={() => setShowAccountModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={emailLoading} className="btn btn-primary">
                    {emailLoading ? 'Updating...' : 'Update Email'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                    Current Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Enter current password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      style={{ width: '100%', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      style={{ width: '100%', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      style={{ width: '100%', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button type="button" onClick={() => setShowAccountModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={passwordLoading} className="btn btn-primary">
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <NotificationToasts
        notifications={notifications}
        removeNotification={removeNotification}
        onNavigate={(path) => {
          if (path.includes('super-admin')) setActiveTab('renewals');
        }}
      />
    </div>
  );
}
