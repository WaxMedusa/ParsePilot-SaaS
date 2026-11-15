import { getRedis } from '../redis';

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type LocalBucket = { count: number; resetAt: number };
const localBuckets = new Map<string, LocalBucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [bucketKey, bucket] of localBuckets) {
    if (bucket.resetAt <= now) localBuckets.delete(bucketKey);
  }
}

/**
 * Fixed-window limiter. Redis keeps limits consistent across instances;
 * the in-memory fallback protects single-instance development only and is
 * reported as degraded by /ready when Redis is unavailable.
 */
export async function enforceRateLimit(scope: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const bucketKey = `pp:rl:${scope}:${windowStart}`;

  const redis = await getRedis();
  if (redis) {
    try {
      const count = await redis.incr(bucketKey);
      if (count === 1) {
        await redis.pExpire(bucketKey, windowMs + 1_000);
      }
      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    } catch {
      // Fall through to local limiting rather than failing open.
    }
  }

  sweep(now);
  const bucket = localBuckets.get(bucketKey) ?? { count: 0, resetAt };
  bucket.count += 1;
  localBuckets.set(bucketKey, bucket);
  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
  };
}

/** Test helper — resets the in-process fallback buckets. */
export function resetLocalRateLimits() {
  localBuckets.clear();
}
