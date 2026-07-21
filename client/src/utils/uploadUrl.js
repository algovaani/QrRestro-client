export function resolveUploadUrl(src) {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const origin = apiBase.startsWith('http')
    ? new URL(apiBase).origin
    : window.location.origin;
  return `${origin}${src.startsWith('/') ? '' : '/'}${src}`;
}
