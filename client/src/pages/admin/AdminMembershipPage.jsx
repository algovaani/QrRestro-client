import React, { useState, useEffect, useMemo } from 'react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import UpiQrDisplay from '../../components/common/UpiQrDisplay';
import {
  ShieldAlert,
  Send,
  LogOut,
  CheckCircle2,
  QrCode,
  RefreshCw,
  CreditCard,
  Copy,
  Check,
  ArrowRight,
  Calendar,
  Sparkles,
  Clock,
  Crown,
  Hourglass,
  BadgeCheck,
  Upload,
  Image as ImageIcon,
  XCircle,
  Phone
} from 'lucide-react';
import { getDaysRemaining, formatExpiryDate, getMembershipDaysLabel, resolveMembershipDisplay, isFreePlan } from '../../utils/membershipDays';

export default function AdminMembershipPage({ standalone = false }) {
  const { user, logout, updateUser } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [requested, setRequested] = useState(user?.renewalRequested || false);
  const [requestDate, setRequestDate] = useState(user?.renewalRequestDate || null);
  const [requestedPlanName, setRequestedPlanName] = useState(user?.requestedPlanName || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState('');
  const [copiedUpi, setCopiedUpi] = useState('');
  const [showPlans, setShowPlans] = useState(!user?.renewalRequested);
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');
  const [rejectionReason, setRejectionReason] = useState(user?.renewalRejectionReason || '');
  const [paymentProofUrl, setPaymentProofUrl] = useState(user?.renewalPaymentProof || '');
  const [supportNumber, setSupportNumber] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, statusRes, platformRes] = await Promise.all([
        API.get('/auth/membership-plans'),
        API.get('/auth/subscription-status').catch(() => null),
        API.get('/auth/platform-settings').catch(() => null)
      ]);

      if (plansRes.data.success) {
        const list = plansRes.data.plans || [];
        setPlans(list);
        if (list.length > 0) {
          const preferredNames = [
            statusRes?.data?.user?.membershipOfferPlanName,
            statusRes?.data?.user?.requestedPlanName,
            user?.membershipOfferPlanName,
            user?.requestedPlanName,
            user?.planName
          ].filter(Boolean);

          const preferred =
            list.find((p) => preferredNames.includes(p.name)) ||
            list[0];

          setSelectedPlan((prev) => {
            if (prev && list.some((p) => p._id === prev._id)) return prev;
            return preferred;
          });
        } else {
          setSelectedPlan(null);
        }
      }

      if (statusRes?.data?.success) {
        const u = statusRes.data.user;
        setSubscription(u);
        setRequested(u.renewalRequested);
        setRequestDate(u.renewalRequestDate);
        setRequestedPlanName(u.requestedPlanName || '');
        setShowPlans(!u.renewalRequested);
        setPaymentProofUrl(u.renewalPaymentProof || '');
        setRejectionReason(u.renewalRejectionReason || '');
        if (u.requestedPlanName) {
          const match = (plansRes.data.plans || []).find((p) => p.name === u.requestedPlanName);
          if (match) setSelectedPlan(match);
        }
      }

      if (platformRes?.data?.success) {
        setSupportNumber(platformRes.data.supportNumber || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onActivated = (data) => {
      setRequested(false);
      setShowPlans(false);
      setRequestDate(null);
      setRequestedPlanName('');
      setPaymentProofFile(null);
      setPaymentProofPreview('');
      setPaymentProofUrl('');
      setRejectionReason('');
      setSubscription((prev) => ({ ...prev, ...data, isExpired: false }));
      setMsg('🎉 Membership activated! Opening dashboard...');
      setTimeout(() => navigate('/admin/dashboard'), 1500);
    };

    const onRejected = (data) => {
      setRequested(false);
      setShowPlans(true);
      setRequestDate(null);
      setRequestedPlanName('');
      setPaymentProofFile(null);
      setPaymentProofPreview('');
      setPaymentProofUrl('');
      const reason = data?.renewalRejectionReason || data?.message || 'Request was rejected.';
      setRejectionReason(reason);
      updateUser({
        renewalRequested: false,
        requestedPlanName: '',
        renewalPaymentProof: '',
        renewalRejectionReason: reason,
        renewalRejectedAt: data?.renewalRejectedAt
      });
      setMsg(`❌ Request reject: ${reason}`);
    };

    socket.on('membership_activated', onActivated);
    socket.on('membership_renewal_rejected', onRejected);
    return () => {
      socket.off('membership_activated', onActivated);
      socket.off('membership_renewal_rejected', onRejected);
    };
  }, [socket, navigate, updateUser]);

  const isExpired =
    subscription?.isExpired ||
    subscription?.planStatus === 'Expired' ||
    user?.planStatus === 'Expired';

  const membership = resolveMembershipDisplay({ ...user, ...subscription });
  const expiryDate = membership.expiryDate;
  const daysLeft = membership.daysRemaining;
  const displayPlanName = membership.planName;

  const pendingPlan = useMemo(() => {
    const name = requestedPlanName || selectedPlan?.name;
    return plans.find((p) => p.name === name) || selectedPlan;
  }, [plans, requestedPlanName, selectedPlan]);

  const selectedIsFree = useMemo(
    () => isFreePlan(selectedPlan),
    [selectedPlan]
  );

  const formattedSupportNumber = useMemo(() => {
    const digits = String(supportNumber || '').replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) return '';
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }, [supportNumber]);

  const supportDigits = String(supportNumber || '').replace(/\D/g, '').slice(-10);

  const renderSupportBanner = (compact = false) => {
    if (supportDigits.length !== 10) return null;

    return (
      <div className={`membership-support-banner${compact ? ' membership-support-banner--compact' : ''}`}>
        <div className="membership-support-banner-icon">
          <Phone size={18} />
        </div>
        <div className="membership-support-banner-body">
          <strong>Need help with membership?</strong>
          <p>Call or WhatsApp our support team at <span>+91 {formattedSupportNumber}</span></p>
        </div>
        <div className="membership-support-banner-actions">
          <a href={`tel:+91${supportDigits}`} className="btn btn-secondary btn-sm">
            Call
          </a>
          <a
            href={`https://wa.me/91${supportDigits}?text=${encodeURIComponent('Hi, I need help with restaurant membership.')}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary btn-sm"
          >
            WhatsApp
          </a>
        </div>
      </div>
    );
  };

  const copyUpi = (upi) => {
    if (!upi) return;
    navigator.clipboard.writeText(upi);
    setCopiedUpi(upi);
    setTimeout(() => setCopiedUpi(''), 2000);
  };

  const handlePaymentProofChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg('Please upload an image file only (JPG, PNG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg('Image must be smaller than 5MB.');
      return;
    }
    setPaymentProofFile(file);
    setPaymentProofPreview(URL.createObjectURL(file));
    setMsg('');
  };

  const clearPaymentProof = () => {
    setPaymentProofFile(null);
    setPaymentProofPreview('');
  };

  const handleRequestRenewal = async () => {
    if (!selectedPlan) {
      setMsg('Please select a membership plan first.');
      return;
    }
    if (!selectedIsFree && !paymentProofFile) {
      setMsg('Upload a payment screenshot — request cannot be submitted without proof.');
      return;
    }
    setSubmitting(true);
    setMsg('');
    try {
      if (selectedIsFree) {
        const res = await API.post('/super-admin/request-renewal', { planName: selectedPlan.name });
        if (res.data.success) {
          const u = res.data.user;
          updateUser({
            ...u,
            isExpired: false,
            renewalRequested: false,
            freeTrialUsed: true
          });
          setMsg('Free trial activated! Opening dashboard...');
          setTimeout(() => navigate('/admin/dashboard'), 1500);
        }
        return;
      }

      const formData = new FormData();
      formData.append('planName', selectedPlan.name);
      formData.append('paymentProof', paymentProofFile);

      const res = await API.post('/super-admin/request-renewal', formData);
      if (res.data.success) {
        const u = res.data.user;
        setRequested(true);
        setShowPlans(false);
        setRequestDate(u.renewalRequestDate);
        setRequestedPlanName(u.requestedPlanName || selectedPlan.name);
        setPaymentProofUrl(u.renewalPaymentProof || '');
        setRejectionReason('');
        setPaymentProofFile(null);
        setPaymentProofPreview('');
        updateUser({
          renewalRequested: true,
          renewalRequestDate: u.renewalRequestDate,
          requestedPlanName: u.requestedPlanName || selectedPlan.name,
          renewalPaymentProof: u.renewalPaymentProof || '',
          renewalRejectionReason: '',
          renewalRejectedAt: null
        });
        setMsg(`Request sent — Super Admin will review "${selectedPlan.name}".`);
      }
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error submitting renewal request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckReactivation = async () => {
    setChecking(true);
    setMsg('');
    try {
      const res = await API.get('/auth/subscription-status');
      if (res.data.success) {
        const u = res.data.user;
        setSubscription(u);
        const expired = u.isExpired || u.planStatus === 'Expired';

        if (!expired) {
          updateUser({
            ...u,
            isExpired: false,
            renewalRequested: false,
            requestedPlanName: ''
          });
          setRequested(false);
          setMsg('Membership active! Redirecting to dashboard...');
          setTimeout(() => navigate('/admin/dashboard'), 1200);
        } else {
          setMsg('Still pending — Super Admin will verify payment and activate your plan.');
        }
      }
    } catch {
      setMsg('Could not check status. Please try again in a moment.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const timelineSteps = [
    { key: 'pay', label: 'Payment', done: requested },
    { key: 'req', label: 'Request Sent', done: requested },
    { key: 'review', label: 'Super Admin Review', done: false, active: requested },
    { key: 'active', label: 'Membership Active', done: !isExpired && !requested }
  ];

  const content = (
    <div className={`membership-page ${standalone ? 'membership-page--standalone' : ''}`}>
      {/* Hero status */}
      <div className={`membership-hero ${isExpired ? 'membership-hero--expired' : requested ? 'membership-hero--pending' : 'membership-hero--active'}`}>
        <div className="membership-hero-icon">
          {requested ? <Hourglass size={32} /> : isExpired ? <ShieldAlert size={32} /> : <Crown size={32} />}
        </div>
        <div className="membership-hero-body">
          <h2>
            {requested
              ? 'Membership Request Pending'
              : !user?.isActive
                ? 'Account Deactivated — Renew Membership'
              : isExpired
                ? 'Plan Expired — Renew Now'
                : 'My Membership'}
          </h2>
          <p>
            {user?.restaurantName} • {displayPlanName}
            {expiryDate && !requested && (
              <> • Valid till <strong>{formatExpiryDate(expiryDate)}</strong></>
            )}
            {!isExpired && !requested && daysLeft >= 0 && (
              <> • <strong className={daysLeft <= 3 ? 'text-warning' : 'text-success'}>{getMembershipDaysLabel(daysLeft)}</strong></>
            )}
          </p>
        </div>
      </div>

      {renderSupportBanner()}

      {msg && (
        <div className={`membership-alert ${msg.includes('active') || msg.includes('activate') ? 'membership-alert--success' : msg.includes('reject') ? 'membership-alert--danger' : ''}`}>
          {msg}
        </div>
      )}

      {rejectionReason && !requested && (
        <div className="membership-rejection-banner">
          <XCircle size={18} />
          <div>
            <strong>Previous request was rejected</strong>
            <p>{rejectionReason}</p>
          </div>
        </div>
      )}

      {!requested && user?.membershipOfferSent && user?.membershipOfferPlanName && (
        <div className="membership-offer-banner">
          <Sparkles size={18} />
          Super Admin sent an offer for the <strong>{user.membershipOfferPlanName}</strong> plan — select it below and pay.
        </div>
      )}

      {requested && pendingPlan && (
        <div className="membership-pending-card">
          <div className="membership-pending-header">
            <BadgeCheck size={22} color="var(--info)" />
            <div>
              <h3>Your Membership Request Has Been Submitted</h3>
              <p>Super Admin will verify payment and activate your plan</p>
            </div>
          </div>

          <div className="membership-pending-plan">
            <div className="membership-pending-plan-top">
              <div>
                <span className="membership-plan-tag">Requested Plan</span>
                <h4>{pendingPlan.name}</h4>
                <span className="membership-plan-meta">
                  <Calendar size={14} /> {pendingPlan.durationDays} days • ₹{pendingPlan.price}
                </span>
              </div>
              <div className="membership-pending-price">₹{pendingPlan.price}</div>
            </div>

            {pendingPlan.features?.length > 0 && (
              <ul className="membership-feature-list">
                {pendingPlan.features.map((f, i) => (
                  <li key={i}><CheckCircle2 size={14} /> {f}</li>
                ))}
              </ul>
            )}

            {requestDate && (
              <div className="membership-request-meta">
                <Clock size={14} />
                Request date: {new Date(requestDate).toLocaleString('en-IN')}
              </div>
            )}

            {paymentProofUrl && (
              <div className="membership-proof-sent">
                <ImageIcon size={14} /> Payment screenshot submitted — Super Admin is verifying
              </div>
            )}
          </div>

          <div className="membership-timeline">
            {timelineSteps.map((step, idx) => (
              <div
                key={step.key}
                className={`membership-timeline-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}
              >
                <div className="membership-timeline-dot">
                  {step.done ? <Check size={12} /> : idx + 1}
                </div>
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          {renderSupportBanner(true)}

          <div className="membership-pending-actions">
            <button
              onClick={handleCheckReactivation}
              disabled={checking}
              className="btn btn-primary"
              style={{ flex: 1, borderRadius: '12px' }}
            >
              <RefreshCw size={16} />
              {checking ? 'Checking...' : 'Check if Activated'}
            </button>
            <button
              type="button"
              onClick={() => setShowPlans((v) => !v)}
              className="btn btn-secondary"
              style={{ borderRadius: '12px' }}
            >
              {showPlans ? 'Hide Plans' : 'Change Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Active membership card (not pending) */}
      {!requested && !isExpired && selectedPlan && (
        <div className="membership-active-card">
          <div className="membership-active-badge"><Crown size={16} /> Active Plan</div>
          <h3>{displayPlanName}</h3>
          {expiryDate && (
            <p>{formatExpiryDate(expiryDate)} • {getMembershipDaysLabel(daysLeft)}</p>
          )}
          <Link to="/admin/dashboard" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
            <ArrowRight size={14} /> Go to Dashboard
          </Link>
        </div>
      )}

      {/* Steps guide — hide when pending unless showPlans */}
      {(!requested || showPlans) && (
        <>
          <div className="membership-steps-card">
            <h3><Sparkles size={18} /> How to Get Membership</h3>
            <div className="membership-steps-list">
              {(selectedIsFree
                ? [
                    { n: 1, t: 'Choose Free Plan', d: 'Select the free trial plan below' },
                    { n: 2, t: 'Activate', d: 'Click activate — no payment needed' },
                    { n: 3, t: 'Start Using', d: 'Dashboard opens immediately' }
                  ]
                : [
                    { n: 1, t: 'Choose a Plan', d: 'Select your plan below' },
                    { n: 2, t: 'Scan QR & Pay', d: 'Pay with PhonePe / GPay / Paytm' },
                    { n: 3, t: 'Upload Screenshot', d: 'Upload payment screenshot and submit request' },
                    { n: 4, t: 'Check Activation', d: 'Dashboard opens after Super Admin approval' }
                  ]
              ).map((s) => (
                <div key={s.n} className="membership-step-row">
                  <span className="membership-step-num">{s.n}</span>
                  <div>
                    <strong>{s.t}</strong>
                    <span>{s.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <h3 className="membership-section-title">
            {selectedIsFree ? 'Select Free Plan' : 'Select Plan & Pay via QR'}
          </h3>

          {loading ? (
            <div className="membership-loading">Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="membership-empty">
              {user?.freeTrialUsed
                ? 'Free trial already used. No paid plans are available right now — contact Super Admin.'
                : 'No plans available right now. Contact Super Admin.'}
            </div>
          ) : (
            <div className="membership-plans-grid">
              {plans.map((plan) => {
                const isSelected = selectedPlan?._id === plan._id;
                const planIsFree = isFreePlan(plan);
                return (
                  <div
                    key={plan._id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`membership-plan-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="membership-plan-card-head">
                      <div>
                        <h4>{plan.name}</h4>
                        <span><Calendar size={13} /> {plan.durationDays} days</span>
                      </div>
                      <strong>{plan.price === 0 ? 'FREE' : `₹${plan.price}`}</strong>
                    </div>

                    {plan.description && <p className="membership-plan-desc">{plan.description}</p>}

                    {plan.features?.length > 0 && (
                      <div className="membership-plan-features">
                        {plan.features.slice(0, 4).map((f, i) => (
                          <span key={i}>✓ {f}</span>
                        ))}
                      </div>
                    )}

                    {isSelected && (
                      planIsFree ? (
                        <div className="membership-qr-box" style={{ textAlign: 'center', padding: '1rem' }}>
                          <CheckCircle2 size={28} color="var(--success)" />
                          <p style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--secondary)', marginTop: '0.65rem' }}>
                            No payment required — activate free trial below
                          </p>
                        </div>
                      ) : (
                      <div className="membership-qr-box">
                        <UpiQrDisplay
                          upiId={plan.upiId}
                          payeeName={plan.name}
                          amount={plan.price}
                          note={`Membership ${plan.name}`}
                          size={200}
                        />
                        {plan.upiId && (
                          <>
                            <p style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--secondary)', marginTop: '0.65rem' }}>
                              <QrCode size={14} style={{ verticalAlign: 'middle' }} /> Scan & Pay ₹{plan.price}
                            </p>
                            <div className="membership-upi-row">
                              UPI: <strong>{plan.upiId}</strong>
                              <button type="button" onClick={(e) => { e.stopPropagation(); copyUpi(plan.upiId); }} className="btn btn-secondary btn-sm">
                                {copiedUpi === plan.upiId ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!requested && (
            <div className="membership-submit-card">
              <h3>
                {selectedIsFree
                  ? 'Activate Free Trial'
                  : 'Upload Screenshot After Payment & Submit Request'}
              </h3>
              <p className="membership-submit-hint">
                {selectedIsFree
                  ? 'This plan is free — no UPI payment or screenshot needed. Click activate to start immediately.'
                  : 'Upload your UPI payment screenshot here — Super Admin will verify it and activate your plan.'}
              </p>

              {renderSupportBanner(true)}

              {!selectedIsFree && (
              <div className="membership-proof-upload">
                {paymentProofPreview ? (
                  <div className="membership-proof-preview">
                    <img src={paymentProofPreview} alt="Payment proof preview" />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={clearPaymentProof}>
                      Change Screenshot
                    </button>
                  </div>
                ) : (
                  <label className="membership-proof-dropzone">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePaymentProofChange}
                      hidden
                    />
                    <Upload size={28} />
                    <span>Upload Payment Screenshot</span>
                    <small>JPG, PNG — max 5MB</small>
                  </label>
                )}
              </div>
              )}

              <button
                onClick={handleRequestRenewal}
                disabled={submitting || !selectedPlan || (!selectedIsFree && !paymentProofFile)}
                className="btn btn-primary pulse-button membership-submit-btn"
              >
                <Send size={18} />
                {submitting
                  ? 'Submitting...'
                  : selectedPlan
                    ? selectedIsFree
                      ? `Activate Free — ${selectedPlan.name}`
                      : `Submit Request — ${selectedPlan.name} (₹${selectedPlan.price})`
                    : 'Select a plan first'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Footer actions for standalone / expired */}
      {(standalone || isExpired) && (
        <div className="membership-footer-actions">
          {standalone && (
            <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', color: 'var(--danger)' }}>
              <LogOut size={16} /> Logout
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (standalone) {
    return (
      <div className="membership-standalone-wrap">
        {content}
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Buy / Renew Membership" />
        <div className="admin-content">{content}</div>
      </div>
    </div>
  );
}
