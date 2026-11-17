import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    dataRequest: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
  },
  createJob: vi.fn(),
}));

vi.mock('../prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../jobs/service', () => ({ createJob: mocks.createJob }));
vi.mock('../audit', () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../config/retention', () => ({ retentionConfig: { accountDeletionGraceDays: 30 } }));
vi.mock('../auth/password', () => ({ verifyPassword: vi.fn() }));
vi.mock('../auth/session', () => ({ revokeAllUserSessions: vi.fn() }));

import { createAccountExportRequest, resumePendingDataExports } from './data-requests';

describe('account export scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.dataRequest.findFirst.mockResolvedValue(null);
    mocks.prisma.dataRequest.findMany.mockResolvedValue([]);
    mocks.prisma.dataRequest.create.mockImplementation(({ data }) => ({ id: 'request-1', ...data }));
    mocks.prisma.workspaceMember.findFirst.mockResolvedValue({ workspaceId: 'ws-1' });
  });

  it('enqueues a follow-up sweep for an export created during a running sweep', async () => {
    // The running sweep holds the active slot, so createJob returns that job.
    mocks.createJob.mockResolvedValue({ id: 'sweep-running', status: 'running' });

    await createAccountExportRequest('user-1', 'ws-1');
    expect(mocks.createJob).toHaveBeenCalledTimes(1);

    // The running sweep queried pending requests before this one existed.
    mocks.prisma.dataRequest.findMany.mockResolvedValue([
      { id: 'request-1', workspaceId: 'ws-1', userId: 'user-1' },
    ]);
    mocks.createJob.mockClear();
    mocks.createJob.mockResolvedValue({ id: 'sweep-follow-up', status: 'queued' });

    await resumePendingDataExports();

    expect(mocks.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'retention_sweep',
        workspaceId: 'ws-1',
        idempotencyKey: 'privacy-export:request-1',
      }),
    );
  });

  it('does nothing when no export is pending', async () => {
    await resumePendingDataExports();
    expect(mocks.createJob).not.toHaveBeenCalled();
  });
});
