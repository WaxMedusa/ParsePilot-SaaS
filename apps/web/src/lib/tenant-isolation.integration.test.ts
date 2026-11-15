import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from './prisma';
import { findDocumentForWorkspace } from './documents/repository';
import { recordPagesUsage } from './billing/usage';

const databaseAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

const suite = databaseAvailable ? describe : describe.skip;

suite('tenant isolation and ledger idempotency (integration)', () => {
  const suffix = randomUUID().slice(0, 8);
  let userId = '';
  let workspaceA = '';
  let workspaceB = '';
  let documentId = '';

  beforeAll(async () => {
    const plan = await prisma.plan.findUnique({ where: { code: 'free' } });
    if (!plan) throw new Error('Seed the database before running integration tests (npm run db:seed)');

    const user = await prisma.user.create({
      data: { email: `integration-${suffix}@parsepilot.test`, name: 'Integration Test', passwordHash: 'scrypt$test$test$test$AAAA$AAAA' },
    });
    userId = user.id;

    const a = await prisma.workspace.create({
      data: {
        name: 'Integration A',
        slug: `integration-a-${suffix}`,
        ownerId: userId,
        planCode: 'free',
        members: { create: { userId, role: 'owner' } },
      },
    });
    workspaceA = a.id;

    const b = await prisma.workspace.create({
      data: {
        name: 'Integration B',
        slug: `integration-b-${suffix}`,
        ownerId: userId,
        planCode: 'free',
        members: { create: { userId, role: 'owner' } },
      },
    });
    workspaceB = b.id;

    const document = await prisma.document.create({
      data: {
        workspaceId: workspaceA,
        uploadedById: userId,
        originalName: 'tenant-test.pdf',
        storageKey: `workspaces/${workspaceA}/documents/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksumSha256: randomUUID().replace(/-/g, ''),
      },
    });
    documentId = document.id;
  }, 30_000);

  afterAll(async () => {
    if (workspaceA) await prisma.workspace.delete({ where: { id: workspaceA } }).catch(() => undefined);
    if (workspaceB) await prisma.workspace.delete({ where: { id: workspaceB } }).catch(() => undefined);
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  }, 30_000);

  it('returns a document only to its own workspace', async () => {
    const found = await findDocumentForWorkspace(documentId, workspaceA);
    expect(found.id).toBe(documentId);

    await expect(findDocumentForWorkspace(documentId, workspaceB)).rejects.toThrow('Document not found');
  });

  it('charges a processing job exactly once even when completion is retried', async () => {
    const jobId = randomUUID();
    const first = await recordPagesUsage(prisma, { workspaceId: workspaceA, documentId, jobId, pages: 3 });
    const second = await recordPagesUsage(prisma, { workspaceId: workspaceA, documentId, jobId, pages: 3 });

    expect(first.charged).toBe(true);
    expect(second.charged).toBe(false);

    const ledger = await prisma.usageLedger.count({ where: { workspaceId: workspaceA, idempotencyKey: `usage:job:${jobId}` } });
    expect(ledger).toBe(1);
  });

  it('keeps ledger rows and periods scoped per workspace', async () => {
    const jobId = randomUUID();
    await recordPagesUsage(prisma, { workspaceId: workspaceA, documentId, jobId, pages: 2 });
    const countB = await prisma.usageLedger.count({ where: { workspaceId: workspaceB } });
    const countA = await prisma.usageLedger.count({ where: { workspaceId: workspaceA, idempotencyKey: `usage:job:${jobId}` } });
    expect(countB).toBe(0);
    expect(countA).toBe(1);
  });
});

if (!databaseAvailable) {
  describe('database integration prerequisites', () => {
    it('is skipped because PostgreSQL is not reachable; start it and run migrations to enable', () => {
      expect(databaseAvailable).toBe(false);
    });
  });
}
