export const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://api.navocs.com');

export function buildAuthHeaders(token: string | null, headers: HeadersInit = {}) {
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}