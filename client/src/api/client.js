import axios from 'axios';

// In production we ship the SPA from the same Express server that hosts the
// API, so an empty/undefined VITE_API_URL means "same origin" — and the
// axios baseURL becomes the relative path `/api`. In dev, client/.env still
// points at http://localhost:4000 so Vite on :5173 can reach the API on :4000.
const RAW_API_URL = import.meta.env.VITE_API_URL ?? '';
export const API_URL = RAW_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '');

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

let getToken = () => localStorage.getItem('afya.token');
let onUnauthorized = () => {};

export function configureApi(opts) {
  if (opts.getToken) getToken = opts.getToken;
  if (opts.onUnauthorized) onUnauthorized = opts.onUnauthorized;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) onUnauthorized();
    return Promise.reject(err);
  }
);

// Fetch an authenticated HTML response and open it in a new window/tab.
// Browsers don't include localStorage tokens on a plain anchor click, so
// we proxy the response through a blob URL — same printable view, but
// the bearer header makes it past auth middleware.
export async function openAuthenticatedHtml(path) {
  const res = await api.get(path, { responseType: 'text' });
  const blob = new Blob([res.data], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener');
  // Revoke after a short delay to give the new window time to load.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return w;
}
