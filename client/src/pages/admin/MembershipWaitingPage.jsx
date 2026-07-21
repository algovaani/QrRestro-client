import React from 'react';
import { Clock, Mail, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

/** When Super Admin has not sent a membership offer yet (deactivated account) */
export default function MembershipWaitingPage({ standalone = false }) {
  const content = (
    <div className="membership-waiting">
      <div className="membership-waiting-icon">
        <Clock size={40} color="#64748b" />
      </div>
      <h2>Waiting for Super Admin Offer</h2>
      <p>
        Your account is currently deactivated.
        <br />
        When <strong>Super Admin</strong> sends a membership offer, you can
        <strong> buy or renew membership</strong>.
      </p>
      <div className="membership-waiting-tip">
        <Mail size={16} />
        Contact Super Admin or wait for their offer.
      </div>
      {standalone && (
        <Link
          to="/admin/membership"
          className="btn btn-primary"
          style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <CreditCard size={16} /> Membership Page
        </Link>
      )}
    </div>
  );

  if (standalone) {
    return <div className="membership-standalone-wrap">{content}</div>;
  }

  return content;
}
