import API, { getApiOrigin } from '../services/api';

function buildAbsoluteApiPath(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const envApi = import.meta.env.VITE_API_URL?.trim();

  if (envApi && (envApi.startsWith('http://') || envApi.startsWith('https://'))) {
    const base = envApi.replace(/\/$/, '');
    if (normalizedPath.startsWith('/api/') && base.endsWith('/api')) {
      return `${base}${normalizedPath.slice(4)}`;
    }
    if (normalizedPath.startsWith('/api/')) {
      return `${base}${normalizedPath}`;
    }
    try {
      return `${new URL(base).origin}${normalizedPath}`;
    } catch {
      return `${base}${normalizedPath}`;
    }
  }

  const storedOrigin = getApiOrigin();
  if (storedOrigin && normalizedPath.startsWith('/api/')) {
    return `${storedOrigin.replace(/\/$/, '')}${normalizedPath}`;
  }

  if (normalizedPath.startsWith('/api/')) {
    return normalizedPath;
  }

  const origin = storedOrigin || window.location.origin;
  return `${origin.replace(/\/$/, '')}${normalizedPath}`;
}

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

  return buildAbsoluteApiPath(src);
}

export function resolveMenuItemImageUrl(item) {
  if (!item?.image) return null;
  const base = resolveUploadUrl(item.image);
  if (!base) return null;
  const version = item.updatedAt ? new Date(item.updatedAt).getTime() : '';
  if (!version) return base;
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}v=${version}`;
}

/** @deprecated use resolveUploadUrl */
export const resolveImageUrl = resolveUploadUrl;
