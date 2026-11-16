import { NextResponse } from 'next/server';
import { checkDatabase } from '@/lib/prisma';
import { checkRedis } from '@/lib/redis';
import { getStorage } from '@/lib/storage';
import { checkProcessor } from '@/lib/jobs/queue';
import { appConfig, isProduction } from '@/lib/env';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Readiness probe. Reports each dependency as ok/degraded without exposing
 * configuration, credentials or stack traces. In production Redis, object
 * storage and the processing service are required; in development their
 * absence is reported as degraded so local UI work remains possible.
 */
export async function GET() {
  const usesRedis = appConfig.queueDriver === 'redis';
  const [database, storage, redis, processor] = await Promise.all([
    checkDatabase(),
    getStorage()
      .healthCheck()
      .catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.name : 'unknown' })),
    usesRedis ? checkRedis() : Promise.resolve({ ok: true, latencyMs: 0 }),
    usesRedis ? checkProcessor() : Promise.resolve({ ok: true, latencyMs: 0 }),
  ]);

  const checks = {
    database: { ok: database.ok, latencyMs: database.latencyMs },
    storage: { ok: storage.ok, driver: getStorage().driver },
    queue: { ok: true, driver: appConfig.queueDriver },
    ...(usesRedis
      ? {
          redis: { ok: redis.ok, latencyMs: redis.latencyMs },
          processor: { ok: processor.ok, latencyMs: processor.latencyMs },
        }
      : {}),
  };

  const requiredOk = checks.database.ok && checks.storage.ok && (!isProduction || !usesRedis || (redis.ok && processor.ok));
  const degraded = Object.entries(checks)
    .filter(([, value]) => !value.ok)
    .map(([key]) => key);

  if (!requiredOk) {
    logger.warn('readiness_failed', { degraded });
  }

  return NextResponse.json(
    {
      status: requiredOk ? (degraded.length > 0 ? 'degraded' : 'ready') : 'not_ready',
      service: 'parsepilot-web',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: requiredOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
