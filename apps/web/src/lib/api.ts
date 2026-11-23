/** Thin fetch wrapper: JSON in/out, bearer token, typed errors. */
const TOKEN_KEY = 'kiwanja.token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
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

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'You appear to be offline', 'OFFLINE');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = data?.error ?? {};
    const firstIssue = e.details?.fieldErrors ? Object.entries(e.details.fieldErrors as Record<string, string[]>)[0] : null;
    const message = firstIssue ? `${e.message}: ${firstIssue[0]} ${firstIssue[1][0]}` : e.message ?? res.statusText;
    throw new ApiError(res.status, message, e.code ?? 'ERROR', e.details);
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
