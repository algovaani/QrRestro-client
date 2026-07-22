import { Star } from 'lucide-react';

export function OrderRatingDisplay({ rating, review, compact = false }) {
  if (!rating) {
    return compact ? null : (
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No rating yet</span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.15rem' : '0.35rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={compact ? 12 : 16}
            color={star <= rating ? '#f59e0b' : '#cbd5e1'}
            fill={star <= rating ? '#f59e0b' : 'none'}
          />
        ))}
        <span style={{ fontSize: compact ? '0.72rem' : '0.8rem', fontWeight: '700', color: '#b45309', marginLeft: '0.2rem' }}>
          {rating}/5
        </span>
      </div>
      {review && (
        <div
          style={{
            fontSize: compact ? '0.72rem' : '0.82rem',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            lineHeight: 1.4
          }}
        >
          "{review}"
        </div>
      )}
    </div>
  );
}

export default OrderRatingDisplay;
