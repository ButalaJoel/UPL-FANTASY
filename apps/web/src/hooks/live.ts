import { useLiveUpdates as useSharedLiveUpdates, type LiveNotification } from '@kiwanja/client';
import { useCallback, useState } from 'react';
import '../lib/api';

export { useMatchRoom } from '@kiwanja/client';

export interface Toast extends LiveNotification {
  id: number;
}

/** Shared live updates plus web toasts for pushed notifications. */
export function useLiveUpdates() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const onNotification = useCallback((n: LiveNotification) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, ...n }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  const { connected } = useSharedLiveUpdates(onNotification);
  return { toasts, dismiss: (id: number) => setToasts((t) => t.filter((x) => x.id !== id)), connected };
}
