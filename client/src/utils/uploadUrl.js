import { getApiOrigin } from '../services/api';

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
  const origin = getApiOrigin() || window.location.origin;

  return `${origin.replace(/\/$/, '')}${path}`;
}

/** @deprecated use resolveUploadUrl */
export const resolveImageUrl = resolveUploadUrl;
