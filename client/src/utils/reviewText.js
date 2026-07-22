export const MAX_REVIEW_WORDS = 50;

export function countReviewWords(text) {
  if (!text || !String(text).trim()) return 0;
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

/** Final save — normalize spaces, cap word count */
export function sanitizeReviewForSave(text, maxWords = MAX_REVIEW_WORDS) {
  if (!text) return '';
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

/** @deprecated use sanitizeReviewForSave on submit only */
export function trimReviewToWordLimit(text, maxWords = MAX_REVIEW_WORDS) {
  return sanitizeReviewForSave(text, maxWords);
}

export function isReviewWithinWordLimit(text, maxWords = MAX_REVIEW_WORDS) {
  return countReviewWords(text) <= maxWords;
}
