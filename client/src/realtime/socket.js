import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';

// Single long-lived socket. We avoid tearing it down on every component mount
// (React StrictMode double-mounts effects in dev, and rapid disconnect during
// the websocket handshake is what causes the noisy console message
//   "WebSocket is closed before the connection is established."
// ). Instead, we keep one instance and just refresh its auth token if the
// caller signs in / out.
let socket = null;

export function getSocket(token) {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || API_URL, {
      auth: { token: token || null },
      // Start with polling and let socket.io upgrade to websocket once the
      // session is established. This eliminates the aborted-handshake warning
      // some browsers log when the very first frame is a websocket probe.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    return socket;
  }

  // Refresh auth token without recreating the socket. If the token actually
  // changed and we're already connected, reconnect cleanly so the server
  // re-runs its handshake middleware with the new credentials.
  const prev = socket.auth?.token || null;
  const next = token || null;
  if (prev !== next) {
    socket.auth = { ...(socket.auth || {}), token: next };
    if (socket.connected) {
      socket.disconnect();
      socket.connect();
    } else if (!socket.active) {
      socket.connect();
    }
  } else if (!socket.connected && !socket.active) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
