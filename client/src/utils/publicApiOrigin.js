/** Origin where /api/public/* routes are served (backend host in split deploy) */
export function getPublicApiOrigin() {
  const explicit = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit.replace(/\/$/, '')).origin;
    } catch {
      return explicit.replace(/\/$/, '');
    }
  }

  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiUrl && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      /* fall through */
    }
  }

  return window.location.origin;
}
