import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { can } from '@kiwanja/core';
import { config } from '../config.js';
import { userFromToken } from './auth.js';

/**
 * Real-time channel. Rooms:
 *   live          everyone: fixture scores, points and leaderboard invalidations
 *   match:<id>    match centre viewers of one fixture
 *   user:<id>     one user's notifications
 *   ops:<id>      data-operations staff working one fixture (event log, verification)
 */
let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: config.webOrigin, credentials: true }, path: '/socket.io' });
  io.on('connection', async (socket) => {
    const user = await userFromToken(socket.handshake.auth?.token as string | undefined);
    socket.join('live');
    if (user) socket.join(`user:${user.id}`);
    socket.on('match:join', (id: string) => typeof id === 'string' && socket.join(`match:${id}`));
    socket.on('match:leave', (id: string) => typeof id === 'string' && socket.leave(`match:${id}`));
    socket.on('ops:join', (id: string) => {
      if (user && can(user.role, 'ops.access') && typeof id === 'string') socket.join(`ops:${id}`);
    });
    socket.on('ops:leave', (id: string) => typeof id === 'string' && socket.leave(`ops:${id}`));
  });
  return io;
}

export function emit(room: string, event: string, payload: unknown) {
  io?.to(room).emit(event, payload);
}

export function closeRealtime() {
  io?.close();
  io = null;
}
