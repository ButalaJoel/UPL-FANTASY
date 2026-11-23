/**
 * Offline-first event queue for the analyst console (IndexedDB).
 *
 * Every tap is written to the device first, then synchronised. Each event carries a
 * client-generated UUID, so replaying the queue after a dropped connection can never
 * create duplicates on the server. Device timestamps are preserved.
 */
import type { EventInput } from '@kiwanja/core';

export type QueueStatus = 'queued' | 'syncing' | 'synced' | 'duplicate' | 'rejected';

export interface QueuedEvent {
  clientEventId: string;
  fixtureId: string;
  payload: EventInput;
  status: QueueStatus;
  attempts: number;
  error?: { code: string; message: string };
  serverEventId?: string;
  queuedAt: number;
}

const DB_NAME = 'kiwanja-ops';
const VERSION = 1;

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        const s = db.createObjectStore('queue', { keyPath: 'clientEventId' });
        s.createIndex('fixtureId', 'fixtureId');
      }
      if (!db.objectStoreNames.contains('matches')) db.createObjectStore('matches');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export interface SyncResult {
  clientEventId: string;
  outcome: 'created' | 'replayed' | 'duplicate' | 'rejected';
  eventId?: string;
  error?: { code: string; message: string };
}

export type Sender = (fixtureId: string, events: EventInput[]) => Promise<{ results: SyncResult[] }>;

export class OfflineQueue {
  private dbp: Promise<IDBDatabase> | null = null;
  private memory = new Map<string, QueuedEvent>();
  private memMatches = new Map<string, unknown>();
  private flushing = new Map<string, Promise<SyncResult[]>>();

  constructor(private idb: IDBFactory | null = typeof indexedDB !== 'undefined' ? indexedDB : null) {}

  private db() {
    if (!this.idb) return null;
    if (!this.dbp) this.dbp = open(this.idb).catch(() => (this.idb = null) as never);
    return this.dbp;
  }

  private async store(mode: IDBTransactionMode, name = 'queue') {
    const db = await this.db();
    return db ? db.transaction(name, mode).objectStore(name) : null;
  }

  async put(item: QueuedEvent) {
    const s = await this.store('readwrite');
    if (!s) return void this.memory.set(item.clientEventId, item);
    await done(s.put(item));
  }

  async enqueue(fixtureId: string, payload: EventInput): Promise<QueuedEvent> {
    const item: QueuedEvent = { clientEventId: payload.clientEventId, fixtureId, payload, status: 'queued', attempts: 0, queuedAt: Date.now() };
    await this.put(item);
    return item;
  }

  async list(fixtureId: string): Promise<QueuedEvent[]> {
    const s = await this.store('readonly');
    const all = s ? await done(s.index('fixtureId').getAll(fixtureId)) : [...this.memory.values()].filter((q) => q.fixtureId === fixtureId);
    return (all as QueuedEvent[]).sort((a, b) => a.queuedAt - b.queuedAt);
  }

  async pending(fixtureId: string) {
    return (await this.list(fixtureId)).filter((q) => q.status === 'queued' || q.status === 'syncing');
  }

  async remove(clientEventId: string) {
    const s = await this.store('readwrite');
    if (!s) return void this.memory.delete(clientEventId);
    await done(s.delete(clientEventId));
  }

  /** Remove confirmed items, keeping failures visible until the analyst dismisses them. */
  async clearSynced(fixtureId: string) {
    for (const q of await this.list(fixtureId)) if (q.status === 'synced') await this.remove(q.clientEventId);
  }

  /** Send everything pending for a fixture. Safe to call repeatedly or concurrently. */
  flush(fixtureId: string, send: Sender): Promise<SyncResult[]> {
    const running = this.flushing.get(fixtureId);
    if (running) return running;
    const p = this.doFlush(fixtureId, send).finally(() => this.flushing.delete(fixtureId));
    this.flushing.set(fixtureId, p);
    return p;
  }

  private async doFlush(fixtureId: string, send: Sender): Promise<SyncResult[]> {
    const items = await this.pending(fixtureId);
    if (!items.length) return [];
    for (const i of items) await this.put({ ...i, status: 'syncing', attempts: i.attempts + 1 });
    let results: SyncResult[];
    try {
      ({ results } = await send(fixtureId, items.map((i) => i.payload)));
    } catch (e) {
      // Network failure: everything goes back to the queue untouched.
      for (const i of items) await this.put({ ...i, status: 'queued', attempts: i.attempts + 1 });
      throw e;
    }
    for (const r of results) {
      const item = items.find((i) => i.clientEventId === r.clientEventId);
      if (!item) continue;
      const status: QueueStatus = r.outcome === 'created' || r.outcome === 'replayed' ? 'synced' : r.outcome === 'duplicate' ? 'duplicate' : 'rejected';
      await this.put({ ...item, status, attempts: item.attempts + 1, error: r.error, serverEventId: r.eventId });
    }
    return results;
  }

  async cacheMatch(fixtureId: string, state: unknown) {
    const s = await this.store('readwrite', 'matches');
    if (!s) return void this.memMatches.set(fixtureId, state);
    await done(s.put(state, fixtureId));
  }

  async cachedMatch<T>(fixtureId: string): Promise<T | null> {
    const s = await this.store('readonly', 'matches');
    if (!s) return (this.memMatches.get(fixtureId) as T) ?? null;
    return ((await done(s.get(fixtureId))) as T) ?? null;
  }
}

export const offlineQueue = new OfflineQueue();
