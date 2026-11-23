/** Real-time updates over Socket.IO, shared by web and mobile. */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getClientConfig, onClientConfigChange } from './api';

let socket: Socket | null = null;
let socketUrl = '';
let watching = false;

/** One shared connection. It reconnects with the current token after sign-in/out. */
export function getSocket(): Socket {
  if (!socket) {
    socketUrl = getClientConfig().baseUrl;
    socket = io(socketUrl || undefined, {
      path: '/socket.io',
      auth: (cb) => cb({ token: getClientConfig().tokenStore.get() }),
      transports: ['websocket', 'polling'],
    });
  }
  if (!watching) {
    watching = true;
    onClientConfigChange(() => {
      if (!socket) return;
      socket.disconnect();
      if (getClientConfig().baseUrl !== socketUrl) {
        // Pointed at a different server (mobile settings): listeners re-attach on next render.
        socket.removeAllListeners();
        socket = null;
      } else socket.connect();
    });
  }
  return socket;
}

export interface LiveNotification {
  title: string;
  body?: string;
  link?: string;
}

/**
 * Subscribes to server pushes and invalidates cached queries, so every screen (my team,
 * leaderboards, fixtures, player stats) refreshes from the database. `onNotification`
 * lets each app show the push in its own way (toast on web, banner on mobile).
 */
export function useLiveUpdates(onNotification?: (n: LiveNotification) => void) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const points = () => {
      qc.invalidateQueries({ queryKey: ['fantasy'] });
      qc.invalidateQueries({ queryKey: ['players'] });
      qc.invalidateQueries({ queryKey: ['player'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    };
    const board = () => {
      qc.invalidateQueries({ queryKey: ['leagues'] });
      qc.invalidateQueries({ queryKey: ['fantasy'] });
      qc.invalidateQueries({ queryKey: ['gameweeks'] });
    };
    const fixture = () => qc.invalidateQueries({ queryKey: ['fixtures'] });
    const gameweek = () => {
      qc.invalidateQueries({ queryKey: ['meta'] });
      board();
    };
    const notification = (n: LiveNotification) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      onNotification?.(n);
    };
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('points:update', points);
    s.on('leaderboard:update', board);
    s.on('fixture:update', fixture);
    s.on('gameweek:update', gameweek);
    s.on('notification', notification);
    setConnected(s.connected);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('points:update', points);
      s.off('leaderboard:update', board);
      s.off('fixture:update', fixture);
      s.off('gameweek:update', gameweek);
      s.off('notification', notification);
    };
  }, [qc, onNotification]);
  return { connected };
}

/** Join a match room and keep that match's state fresh. */
export function useMatchRoom(fixtureId: string | undefined, room: 'match' | 'ops' = 'match') {
  const qc = useQueryClient();
  useEffect(() => {
    if (!fixtureId) return;
    const s = getSocket();
    const join = () => s.emit(`${room}:join`, fixtureId);
    join();
    s.on('connect', join);
    const onMatch = () => {
      qc.invalidateQueries({ queryKey: ['match', fixtureId] });
      qc.invalidateQueries({ queryKey: ['ops-match', fixtureId] });
    };
    s.on('match:update', onMatch);
    s.on('ops:event', onMatch);
    return () => {
      s.emit(`${room}:leave`, fixtureId);
      s.off('connect', join);
      s.off('match:update', onMatch);
      s.off('ops:event', onMatch);
    };
  }, [fixtureId, room, qc]);
}
