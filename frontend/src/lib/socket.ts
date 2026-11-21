import { io, Socket } from 'socket.io-client';
import { getStoredToken } from './api';

export function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL.replace(/\/+$/, '');
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  const token = getStoredToken();
  const socketUrl = getSocketUrl();

  if (!socketInstance) {
    socketInstance = io(socketUrl, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected to SYNCTHEATER Gateway:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  } else {
    // Keep auth token in sync if token changed after login
    socketInstance.auth = { token };
  }

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
