import { createClient, type RedisClientType } from 'redis';
import { logger } from './logger';
import { redisUrl } from './env';

/**
 * Redis is used for queue coordination, rate limits and ephemeral counters only.
 * It is never the system of record: Postgres holds all business state.
 *
 * When REDIS_URL is absent (unit tests, preview builds) callers fall back to
 * process-local behaviour and the readiness endpoint reports the degradation.
 */

const globalForRedis = globalThis as unknown as {
  __parsepilotRedis?: Promise<RedisClientType | null>;
};

async function connect(): Promise<RedisClientType | null> {
  const url = redisUrl();
  if (!url) return null;
  const client = createClient({ url, socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3_000) } });
  client.on('error', (error) => logger.warn('redis_error', { message: error instanceof Error ? error.message : 'unknown' }));
  try {
    await client.connect();
    logger.info('redis_connected');
    return client as RedisClientType;
  } catch (error) {
    logger.error('redis_connection_failed', { message: error instanceof Error ? error.message : 'unknown' });
    return null;
  }
}

export function getRedis(): Promise<RedisClientType | null> {
  if (!globalForRedis.__parsepilotRedis) {
    globalForRedis.__parsepilotRedis = connect();
  }
  return globalForRedis.__parsepilotRedis;
}

export async function checkRedis(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  const client = await getRedis();
  if (!client) return { ok: false, latencyMs: 0, error: 'redis_not_configured_or_unreachable' };
  try {
    await client.ping();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : 'unknown' };
  }
}

export async function queueLength(queueName: string): Promise<number | null> {
  const client = await getRedis();
  if (!client) return null;
  try {
    return await client.lLen(`${queueName}:queued`);
  } catch {
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  const cached = globalForRedis.__parsepilotRedis;
  if (!cached) return;
  const client = await cached;
  if (client?.isOpen) await client.quit();
  globalForRedis.__parsepilotRedis = undefined;
}
