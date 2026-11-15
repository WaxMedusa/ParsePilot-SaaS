import { getRedis } from '../redis';
import { logger } from '../logger';

/**
 * Operational metrics. Counters live in Redis when available so that they are
 * shared between web instances, with a process-local fallback. The values are
 * exposed only through the internal, token-protected metrics endpoint.
 */

const localCounters = new Map<string, number>();
const localGauges = new Map<string, number>();

type MetricTags = Record<string, string | number>;

function key(name: string, tags?: MetricTags): string {
  if (!tags) return name;
  const suffix = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, value]) => `${tag}=${value}`)
    .join(',');
  return `${name}{${suffix}}`;
}

export async function increment(name: string, tags?: MetricTags, amount = 1): Promise<void> {
  const metricKey = key(name, tags);
  localCounters.set(metricKey, (localCounters.get(metricKey) ?? 0) + amount);
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.incrBy(`pp:metric:${metricKey}`, amount);
    } catch (error) {
      logger.debug('metric_write_failed', { metric: metricKey });
    }
  }
}

export async function setGauge(name: string, value: number, tags?: MetricTags): Promise<void> {
  const metricKey = key(name, tags);
  localGauges.set(metricKey, value);
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(`pp:gauge:${metricKey}`, String(value), { EX: 900 });
    } catch {
      logger.debug('gauge_write_failed', { metric: metricKey });
    }
  }
}

/** Records a duration observation and its count/sum so averages are derivable. */
export async function observe(name: string, valueMs: number, tags?: MetricTags): Promise<void> {
  await increment(`${name}_count`, tags);
  await increment(`${name}_sum_ms`, tags, Math.round(valueMs));
  if (valueMs > 60_000) {
    logger.warn('slow_operation', { operation: name, durationMs: Math.round(valueMs), ...tags });
  }
}

export async function metricsSnapshot(): Promise<{ counters: Record<string, number>; gauges: Record<string, number> }> {
  const counters: Record<string, number> = Object.fromEntries(localCounters);
  const gauges: Record<string, number> = Object.fromEntries(localGauges);
  const redis = await getRedis();
  if (redis) {
    try {
      const keys = await redis.keys('pp:metric:*');
      if (keys.length > 0) {
        const values = await redis.mGet(keys);
        keys.forEach((metricKey, index) => {
          counters[metricKey.replace('pp:metric:', '')] = Number(values[index] ?? 0);
        });
      }
      const gaugeKeys = await redis.keys('pp:gauge:*');
      if (gaugeKeys.length > 0) {
        const values = await redis.mGet(gaugeKeys);
        gaugeKeys.forEach((gaugeKey, index) => {
          gauges[gaugeKey.replace('pp:gauge:', '')] = Number(values[index] ?? 0);
        });
      }
    } catch {
      // Redis failure should never break metrics reporting.
    }
  }
  return { counters, gauges };
}
