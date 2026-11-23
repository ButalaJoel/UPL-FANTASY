import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './api';

let socket: Socket | null = null;

/** One shared Socket.IO connection; reconnects with the current token. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', auth: (cb) => cb({ token: tokenStore.get() }), transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function reconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket.connect();
  }
}
