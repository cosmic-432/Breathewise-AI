import type { NextFunction, Request, Response } from 'express';

interface WindowEntry {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  maxTrackedKeys?: number;
}

/**
 * Bounded in-memory sliding-window rate limiter to protect AI and API endpoints.
 * Periodically evicts expired buckets so high-cardinality traffic cannot exhaust memory.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, WindowEntry>();
  const maxTrackedKeys = options.maxTrackedKeys ?? 2000;

  const pruneExpired = (now: number): void => {
    for (const [k, entry] of store.entries()) {
      const active = entry.timestamps.filter((ts) => now - ts < options.windowMs);
      if (active.length === 0) {
        store.delete(k);
      } else {
        entry.timestamps = active;
      }
    }
    while (store.size >= maxTrackedKeys) {
      const oldestKey = store.keys().next().value;
      if (!oldestKey) break;
      store.delete(oldestKey);
    }
  };

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${rawIp}`;

    if (store.size >= maxTrackedKeys && !store.has(key)) {
      pruneExpired(now);
    }

    const entry = store.get(key) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter(
      (ts) => now - ts < options.windowMs,
    );

    if (entry.timestamps.length >= options.maxRequests) {
      const oldest = entry.timestamps[0] ?? now;
      const retryAfterSec = Math.max(
        1,
        Math.ceil((options.windowMs - (now - oldest)) / 1000),
      );
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many requests. Please wait briefly before retrying.',
        code: 'RATE_LIMITED',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    entry.timestamps.push(now);
    store.set(key, entry);
    next();
  };

  return {
    middleware,
    reset: () => store.clear(),
    size: () => store.size,
  };
}
