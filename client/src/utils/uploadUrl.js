export function resolveUploadUrl(src) {
  if (!src) return null;
  if (
    src.startsWith('blob:') ||
    src.startsWith('data:') ||
    src.startsWith('http://') ||
    src.startsWith('https://')
  ) {
    return src;
  }

  const path = src.startsWith('/') ? src : `/${src}`;
  const apiBase = import.meta.env.VITE_API_URL?.trim() || '/api';
  const origin = apiBase.startsWith('http')
    ? new URL(apiBase).origin
    : window.location.origin;

  return `${origin}${path}`;
}

/** @deprecated use resolveUploadUrl */
export const resolveImageUrl = resolveUploadUrl;
