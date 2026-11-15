import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/**
 * Single Prisma client per process (Next.js hot reload aware).
 * All database access goes through the data-access layer modules, which are
 * always scoped by workspace.
 */

const globalForPrisma = globalThis as unknown as { __parsepilotPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.PRISMA_LOG === '1' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
  client.$on('warn', (event) => logger.warn('prisma_warning', { message: event.message }));
  client.$on('error', (event) => logger.error('prisma_error', { message: event.message }));
  return client;
}

export const prisma: PrismaClient = globalForPrisma.__parsepilotPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__parsepilotPrisma = prisma;
}

/** Runs a unit of work in a single database transaction. */
export async function transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction((tx) => fn(tx as PrismaClient), {
    maxWait: 5_000,
    timeout: 20_000,
  });
}

export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.name : 'unknown_error',
    };
  }
}
