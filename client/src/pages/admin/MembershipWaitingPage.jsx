import React from 'react';
import { Clock, Mail, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Jab Super Admin ne abhi membership offer nahi bheja (deactivated account) */
export default function MembershipWaitingPage({ standalone = false }) {
  const content = (
    <div className="membership-waiting">
      <div className="membership-waiting-icon">
        <Clock size={40} color="#64748b" />
      </div>
      <h2>Super Admin Offer Ka Wait</h2>
      <p>
        Aapka account abhi band hai.
        <br />
        <strong>Super Admin</strong> jab membership offer bhejenge tab aap
        <strong> Buy / Renew Membership</strong> kar sakte hain.
      </p>
      <div className="membership-waiting-tip">
        <Mail size={16} />
        Super Admin se contact karein ya unke offer ka wait karein.
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
