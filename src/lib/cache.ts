type Entry<T> = { value: T; expiresAt: number };

/**
 * Tiny process-local TTL cache. The Next.js runtime may spin up several
 * instances on Vercel, so this is only a best-effort shield against hammering
 * the rate-limited upstream APIs — correctness never depends on it.
 */
const store = new Map<string, Entry<unknown>>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.value as T);

  return load().then((value) => {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    if (store.size > 500) {
      const oldest = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) store.delete(oldest[0]);
    }
    return value;
  });
}

const MINUTE = 60_000;
export const TTL = {
  search: 10 * MINUTE,
  detail: 6 * 60 * MINUTE,
  genreList: 24 * 60 * MINUTE,
  userList: 15 * MINUTE,
} as const;
