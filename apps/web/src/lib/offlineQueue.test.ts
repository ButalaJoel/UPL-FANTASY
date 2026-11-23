import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { OfflineQueue, type Sender } from './offlineQueue';

const ev = (id: string, minute = 10) => ({ clientEventId: id, code: 'GOAL', side: 'HOME' as const, playerId: 'p1', minute, clientRecordedAt: new Date('2026-11-23T15:10:00Z') });

describe('offline queue', () => {
  it('keeps events through a network failure and syncs them once connectivity returns', async () => {
    const q = new OfflineQueue(indexedDB);
    await q.enqueue('f1', ev('00000000-0000-4000-8000-000000000001'));
    await q.enqueue('f1', ev('00000000-0000-4000-8000-000000000002', 20));
    const offline: Sender = async () => {
      throw new Error('offline');
    };
    await expect(q.flush('f1', offline)).rejects.toThrow('offline');
    expect((await q.pending('f1')).length).toBe(2);

    const seen: string[] = [];
    const online: Sender = async (_f, events) => {
      events.forEach((e) => seen.push(e.clientEventId));
      return { results: events.map((e) => ({ clientEventId: e.clientEventId, outcome: 'created' as const, eventId: `srv-${e.clientEventId}` })) };
    };
    await q.flush('f1', online);
    expect(seen).toHaveLength(2);
    expect((await q.pending('f1')).length).toBe(0);
    // Preserves device timestamps.
    expect((await q.list('f1'))[0].payload.clientRecordedAt).toEqual(new Date('2026-11-23T15:10:00Z'));
    // A second flush sends nothing: no duplicates.
    await q.flush('f1', online);
    expect(seen).toHaveLength(2);
  });

  it('marks server-side duplicates and rejections without blocking the queue', async () => {
    const q = new OfflineQueue(indexedDB);
    await q.enqueue('f2', ev('00000000-0000-4000-8000-000000000003'));
    await q.enqueue('f2', ev('00000000-0000-4000-8000-000000000004'));
    await q.flush('f2', async (_f, events) => ({
      results: [
        { clientEventId: events[0].clientEventId, outcome: 'created' },
        { clientEventId: events[1].clientEventId, outcome: 'duplicate', error: { code: 'POSSIBLE_DUPLICATE', message: 'dup' } },
      ],
    }));
    const items = await q.list('f2');
    expect(items.map((i) => i.status)).toEqual(['synced', 'duplicate']);
  });

  it('never runs two flushes for the same match at once', async () => {
    const q = new OfflineQueue(indexedDB);
    await q.enqueue('f3', ev('00000000-0000-4000-8000-000000000005'));
    let calls = 0;
    const slow: Sender = async (_f, events) => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { results: events.map((e) => ({ clientEventId: e.clientEventId, outcome: 'created' as const })) };
    };
    await Promise.all([q.flush('f3', slow), q.flush('f3', slow)]);
    expect(calls).toBe(1);
  });
});
