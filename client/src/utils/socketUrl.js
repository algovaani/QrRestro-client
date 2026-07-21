/** Socket.IO server URL — same origin in production single-server deploy */
export function getSocketUrl() {
  const explicit = import.meta.env.VITE_SOCKET_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

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

export const getRestaurantRoom = (adminId) => {
  if (!adminId) return null;
  return `restaurant_${String(adminId)}`;
};
