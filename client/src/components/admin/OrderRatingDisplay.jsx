import { Star } from 'lucide-react';

export function OrderRatingDisplay({ rating, review, compact = false }) {
  if (!rating) {
    return compact ? null : (
      <span className="order-rating-empty">No rating yet</span>
    );
  }

  return (
    <div className={`order-rating-display${compact ? ' order-rating-display--compact' : ''}`}>
      <div className="order-rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={compact ? 12 : 16}
            color={star <= rating ? '#f59e0b' : '#cbd5e1'}
            fill={star <= rating ? '#f59e0b' : 'none'}
          />
        ))}
        <span className="order-rating-score">{rating}/5</span>
      </div>
      {review && (
        <div className="order-rating-review" title={review}>
          &ldquo;{review}&rdquo;
        </div>
      )}
    </div>
  );
}

export default OrderRatingDisplay;
