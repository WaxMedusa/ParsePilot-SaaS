import type { Prisma, Subscription } from '@prisma/client';
import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { logger } from '../logger';

/**
 * Billing policy (documented in docs/billing.md):
 *  - Pages are counted once per accepted processing job, at successful
 *    completion. Retries of the same job never charge again (ledger key per job).
 *  - A manual reprocess creates a new job and therefore a new page charge,
 *    because the document is processed again.
 *  - Uploads are rejected before storage when the exact PDF page count or the
 *    plan's file-size limit would be exceeded.
 *  - Completion rechecks the actual processed page count under a workspace
 *    lock before writing the ledger, so an inaccurate worker result cannot
 *    overrun the allowance.
 *  - Failed jobs that never produce an extraction are not charged.
 */

export type UsagePeriodRange = { start: Date; end: Date };

export function calendarMonthRange(now = new Date()): UsagePeriodRange {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

/** Prefers the paid subscription billing period, falling back to calendar months. */
export function usagePeriodRange(
  subscription: Pick<Subscription, 'currentPeriodStart' | 'currentPeriodEnd'> | null | undefined,
  now = new Date(),
): UsagePeriodRange {
  if (subscription?.currentPeriodStart && subscription.currentPeriodEnd) {
    if (now >= subscription.currentPeriodStart && now < subscription.currentPeriodEnd) {
      return { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd };
    }
  }
  return calendarMonthRange(now);
}

export async function getUsagePeriod(workspaceId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  const range = usagePeriodRange(subscription);
  const period = await prisma.usagePeriod.findUnique({
    where: { workspaceId_periodStart: { workspaceId, periodStart: range.start } },
  });
  return {
    periodStart: range.start,
    periodEnd: range.end,
    pagesProcessed: period?.pagesProcessed ?? 0,
    documentsProcessed: period?.documentsProcessed ?? 0,
    exportRows: period?.exportRows ?? 0,
  };
}

/**
 * Writes the usage ledger entry and increments the period exactly once.
 * Uses INSERT ... ON CONFLICT so a concurrent duplicate callback cannot
 * double-charge, without aborting the surrounding transaction.
 */
export async function recordPagesUsage(
  tx: Prisma.TransactionClient | typeof prisma,
  input: { workspaceId: string; documentId: string; jobId: string; pages: number },
): Promise<{ charged: boolean }> {
  const pages = Math.max(1, Math.min(Math.trunc(input.pages), 5_000));
  const idempotencyKey = `usage:job:${input.jobId}`;

  // Serialise page accounting per workspace. Upload-time counts are exact, but
  // a reprocess or a worker result can still race another job; the lock makes
  // the remaining-quota check and ledger insert one decision.
  await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${input.workspaceId}::uuid FOR UPDATE`;

  const existing = await tx.usageLedger.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return { charged: false };

  const subscription = await tx.subscription.findUnique({ where: { workspaceId: input.workspaceId } });
  const range = usagePeriodRange(subscription);
  const workspace = await tx.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { planCode: true, deletedAt: true },
  });
  if (!workspace || workspace.deletedAt) throw ApiError.notFound('Workspace not found');
  const plan = await tx.plan.findUnique({
    where: { code: workspace.planCode },
    select: { monthlyPageLimit: true },
  });
  if (!plan) throw ApiError.internal('Plan configuration missing');

  const used = await tx.usageLedger.aggregate({
    where: {
      workspaceId: input.workspaceId,
      kind: 'processing_pages',
      occurredAt: { gte: range.start, lt: range.end },
    },
    _sum: { quantity: true },
  });
  const pagesUsed = used._sum.quantity ?? 0;
  if (pagesUsed + pages > plan.monthlyPageLimit) {
    throw ApiError.quotaExceeded(
      'This document would exceed your plan page quota. Upgrade or wait for the next period.',
      { pages, pagesUsed, pageLimit: plan.monthlyPageLimit },
    );
  }

  const inserted = await tx.$executeRaw`
    INSERT INTO "UsageLedger" ("id", "workspaceId", "documentId", "kind", "quantity", "idempotencyKey", "reason", "occurredAt", "createdAt")
    VALUES (gen_random_uuid(), ${input.workspaceId}::uuid, ${input.documentId}::uuid, 'processing_pages'::"UsageLedgerKind", ${pages}, ${idempotencyKey}, 'document_processing', now(), now())
    ON CONFLICT ("idempotencyKey") DO NOTHING
  `;
  if (inserted === 0) return { charged: false };

  await tx.usagePeriod.upsert({
    where: { workspaceId_periodStart: { workspaceId: input.workspaceId, periodStart: range.start } },
    create: {
      workspaceId: input.workspaceId,
      periodStart: range.start,
      periodEnd: range.end,
      pagesProcessed: pages,
      documentsProcessed: 1,
    },
    update: {
      periodEnd: range.end,
      pagesProcessed: { increment: pages },
      documentsProcessed: { increment: 1 },
    },
  });
  logger.info('usage_recorded', { workspaceId: input.workspaceId, pages, periodStart: range.start.toISOString() });
  return { charged: true };
}

export async function recordExportRows(workspaceId: string, rows: number): Promise<void> {
  const range = usagePeriodRange(await prisma.subscription.findUnique({ where: { workspaceId } }));
  await prisma.usagePeriod.upsert({
    where: { workspaceId_periodStart: { workspaceId, periodStart: range.start } },
    create: { workspaceId, periodStart: range.start, periodEnd: range.end, exportRows: rows },
    update: { periodEnd: range.end, exportRows: { increment: rows } },
  });
}

/** Reads authoritative plan + subscription + usage for a workspace. */
export async function getUsageSnapshot(workspaceId: string) {
  const [workspace, subscription, period] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { planCode: true, deletedAt: true } }),
    prisma.subscription.findUnique({ where: { workspaceId } }),
    getUsagePeriod(workspaceId),
  ]);
  if (!workspace) throw ApiError.notFound('Workspace not found');
  const plan = await prisma.plan.findUnique({ where: { code: workspace.planCode } });
  if (!plan) throw ApiError.internal('Plan configuration missing');

  const used = await prisma.usageLedger.aggregate({
    where: {
      workspaceId,
      kind: 'processing_pages',
      occurredAt: { gte: period.periodStart, lt: period.periodEnd },
    },
    _sum: { quantity: true },
  });

  const pagesUsed = used._sum.quantity ?? 0;
  return {
    plan: {
      code: plan.code,
      name: plan.name,
      priceCents: plan.priceCents,
      currency: plan.currency,
      monthlyPageLimit: plan.monthlyPageLimit,
      maxUploadMb: plan.maxUploadMb,
      maxMembers: plan.maxMembers,
      features: plan.features as string[],
    },
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          stripeCustomerId: subscription.stripeCustomerId,
        }
      : { status: 'active' as const, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, stripeCustomerId: null },
    usage: {
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
      pagesUsed,
      pagesRemaining: Math.max(0, plan.monthlyPageLimit - pagesUsed),
      documentsProcessed: period.documentsProcessed,
      exportRows: period.exportRows,
      pageLimit: plan.monthlyPageLimit,
      percentUsed: plan.monthlyPageLimit === 0 ? 100 : Math.min(100, Math.round((pagesUsed / plan.monthlyPageLimit) * 100)),
    },
  };
}

export type UsageSnapshot = Awaited<ReturnType<typeof getUsageSnapshot>>;

export function subscriptionUsable(subscription: {
  status: string;
  lastPaymentFailedAt?: Date | null;
} | null): { usable: boolean; reason?: string } {
  if (!subscription) return { usable: true };
  if (subscription.status === 'active' || subscription.status === 'trialing') return { usable: true };
  if (subscription.status === 'past_due') {
    const graceMs = 7 * 24 * 60 * 60 * 1000;
    const failedAt = subscription.lastPaymentFailedAt?.getTime() ?? 0;
    if (Date.now() - failedAt <= graceMs) return { usable: true };
    return { usable: false, reason: 'Your last payment failed and the grace period has ended.' };
  }
  return { usable: false, reason: 'Your subscription is not active.' };
}

/** Pre-flight check run before accepting an upload. */
export async function assertCanProcess(workspaceId: string, estimatedPages = 1): Promise<UsageSnapshot> {
  const snapshot = await getUsageSnapshot(workspaceId);
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  const usable = subscriptionUsable(subscription);
  if (!usable.usable) {
    throw ApiError.subscriptionInactive(usable.reason ?? 'An active subscription is required');
  }
  if (snapshot.usage.pagesUsed + Math.max(1, estimatedPages) > snapshot.plan.monthlyPageLimit) {
    throw ApiError.quotaExceeded('Your plan page limit has been reached for this billing period', {
      pagesUsed: snapshot.usage.pagesUsed,
      pageLimit: snapshot.plan.monthlyPageLimit,
      periodEnd: snapshot.usage.periodEnd,
    });
  }
  return snapshot;
}

/** Daily pages processed, for the usage chart. Zero-filled for missing days. */
export async function getDailyUsage(workspaceId: string, days = 14): Promise<{ date: string; label: string; pages: number }[]> {
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - (days - 1)));
  const rows = await prisma.$queryRaw<{ day: Date; pages: number }[]>`
    SELECT date_trunc('day', "occurredAt") AS day, COALESCE(SUM("quantity"), 0)::int AS pages
    FROM "UsageLedger"
    WHERE "workspaceId" = ${workspaceId}::uuid
      AND "kind" = 'processing_pages'::"UsageLedgerKind"
      AND "occurredAt" >= ${start}
    GROUP BY 1
    ORDER BY 1
  `;
  const byDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.pages)]));
  const points: { date: string; label: string; pages: number }[] = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
    const iso = date.toISOString().slice(0, 10);
    points.push({
      date: iso,
      label: `${date.getUTCDate()}/${date.getUTCMonth() + 1}`,
      pages: byDay.get(iso) ?? 0,
    });
  }
  return points;
}

export async function assertUploadSizeAllowed(workspaceId: string, sizeBytes: number): Promise<number> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { planCode: true } });
  if (!workspace) throw ApiError.notFound('Workspace not found');
  const plan = await prisma.plan.findUnique({ where: { code: workspace.planCode }, select: { maxUploadMb: true } });
  const maxMb = plan?.maxUploadMb ?? 10;
  if (sizeBytes > maxMb * 1024 * 1024) {
    throw ApiError.payloadTooLarge(`Your plan allows files up to ${maxMb} MB`);
  }
  return maxMb;
}
