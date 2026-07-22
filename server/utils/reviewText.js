const MAX_REVIEW_WORDS = 50;

function countReviewWords(text) {
  if (!text || !String(text).trim()) return 0;
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function trimReviewToWordLimit(text, maxWords = MAX_REVIEW_WORDS) {
  if (!text) return '';
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return String(text).trim();
  return words.slice(0, maxWords).join(' ');
}

module.exports = { MAX_REVIEW_WORDS, countReviewWords, trimReviewToWordLimit };
