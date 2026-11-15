import { appConfig, internalServiceToken } from '../env';
import { logger } from '../logger';
import { increment } from '../observability/metrics';

/**
 * The database row is the authoritative job record. This module only asks the
 * Python processing service to enqueue the job in its Redis-backed RQ queue.
 * If the service is unreachable the job stays `queued` in PostgreSQL and the
 * reconciler re-announces it — a worker outage never loses a document.
 */
export async function enqueueJobRemotely(job: {
  id: string;
  type: string;
  correlationId: string;
  attempts: number;
}): Promise<{ enqueued: boolean; error?: string }> {
  const url = `${appConfig.processorUrl}/internal/jobs`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': internalServiceToken(),
        'x-request-id': job.correlationId,
      },
      body: JSON.stringify({ jobId: job.id, type: job.type, correlationId: job.correlationId, attempt: job.attempts }),
      signal: AbortSignal.timeout(appConfig.processorTimeoutMs),
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`processor responded ${response.status}: ${text.slice(0, 200)}`);
    }
    await increment('queue_enqueued', { type: job.type });
    return { enqueued: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    logger.warn('queue_enqueue_failed', { jobId: job.id, type: job.type, message });
    await increment('queue_enqueue_failed', { type: job.type });
    return { enqueued: false, error: message };
  }
}

/** Checks the processing service health without leaking credentials. */
export async function checkProcessor(): Promise<{ ok: boolean; error?: string; latencyMs: number }> {
  const started = Date.now();
  try {
    const response = await fetch(`${appConfig.processorUrl}/ready`, {
      headers: { 'x-internal-token': internalServiceToken() },
      signal: AbortSignal.timeout(3_000),
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false, latencyMs: Date.now() - started, error: `status_${response.status}` };
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.name : 'unknown' };
  }
}
