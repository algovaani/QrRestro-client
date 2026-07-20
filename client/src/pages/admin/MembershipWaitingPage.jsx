import React from 'react';
import { Clock, Mail } from 'lucide-react';

/** Jab Super Admin ne abhi membership offer nahi bheja */
export default function MembershipWaitingPage({ standalone = false }) {
  const content = (
    <div className="membership-waiting">
      <div className="membership-waiting-icon">
        <Clock size={40} color="#64748b" />
      </div>
      <h2>Membership Offer Pending</h2>
      <p>
        Aapka plan expire ho gaya hai ya renew karna hai.
        <br />
        <strong>Super Admin</strong> jab membership offer bhejenge tab aapko
        <strong> Buy / Renew Membership</strong> option dikhega.
      </p>
      <div className="membership-waiting-tip">
        <Mail size={16} />
        Super Admin se contact karein ya unke offer ka wait karein.
      </div>
    </div>
  );

  if (standalone) {
    return <div className="membership-standalone-wrap">{content}</div>;
  }

  return content;
}
