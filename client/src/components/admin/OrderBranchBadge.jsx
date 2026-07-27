import React from 'react';
import { MapPin } from 'lucide-react';

export default function OrderBranchBadge({ name, compact = false }) {
  if (!name) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: compact ? '0.15rem 0.45rem' : '0.25rem 0.55rem',
        borderRadius: '999px',
        fontSize: compact ? '0.68rem' : '0.72rem',
        fontWeight: 700,
        background: '#eff6ff',
        color: '#1d4ed8',
        border: '1px solid #bfdbfe',
        whiteSpace: 'nowrap'
      }}
      title={`Branch: ${name}`}
    >
      {!compact && <MapPin size={11} />}
      {name}
    </span>
  );
}
