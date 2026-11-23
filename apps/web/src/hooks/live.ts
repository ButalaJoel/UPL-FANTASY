import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Subscribes to real-time pushes and invalidates cached queries, so every screen
 * (my team, leaderboards, fixtures, player stats) refreshes from the database.
 */
export function useLiveUpdates() {
  const qc = useQueryClient();
  const [toasts, setToasts] = useState<Toast[]>([]);
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
    const notification = (n: { title: string; body?: string; link?: string }) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, ...n }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
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
  }, [qc]);
  return { toasts, dismiss: (id: number) => setToasts((t) => t.filter((x) => x.id !== id)), connected };
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
