/**
 * Platform-neutral API client. Each app configures it once at start-up:
 *   web:    configureClient({ baseUrl: '', tokenStore: localStorageTokens })
 *   mobile: configureClient({ baseUrl: 'http://192.168.1.20:4000', tokenStore: secureStoreTokens })
 */
export interface TokenStore {
  /** Synchronous read of the current token (apps keep it in memory). */
  get(): string | null;
  /** Persist or clear the token. */
  set(token: string | null): void | Promise<void>;
}

export interface ClientConfig {
  /** Origin of the API server, without the `/api` suffix. Empty string = same origin. */
  baseUrl: string;
  tokenStore: TokenStore;
}

const memoryTokens: TokenStore = (() => {
  let t: string | null = null;
  return { get: () => t, set: (v) => void (t = v) };
})();

let config: ClientConfig = { baseUrl: '', tokenStore: memoryTokens };
const listeners = new Set<() => void>();

export function configureClient(next: Partial<ClientConfig>) {
  config = { ...config, ...next };
  listeners.forEach((l) => l());
}
export const getClientConfig = () => config;
/** Called when the base URL or token changes (the socket reconnects). */
export const onClientConfigChange = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const tokens = {
  get: () => config.tokenStore.get(),
  set: async (t: string | null) => {
    await config.tokenStore.set(t);
    listeners.forEach((l) => l());
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = config.tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/api${path}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError(0, "Can't reach the server. Check your connection.", 'OFFLINE');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = ((data as { error?: { message?: string; code?: string; details?: { fieldErrors?: Record<string, string[]> } } })?.error ?? {}) as { message?: string; code?: string; details?: { fieldErrors?: Record<string, string[]> } };
    const firstIssue = e.details?.fieldErrors ? Object.entries(e.details.fieldErrors)[0] : null;
    const message = firstIssue ? `${e.message}: ${firstIssue[0]} ${firstIssue[1][0]}` : e.message ?? res.statusText ?? 'Request failed';
    throw new ApiError(res.status, message, e.code ?? 'ERROR', e.details);
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
