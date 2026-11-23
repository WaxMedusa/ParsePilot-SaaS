import { prisma } from '../prisma';
import { ApiError } from '../http/errors';

export type ApprovalResult = {
  approved: boolean;
  nextStep?: string;
  completed: boolean;
  requiredApprovers: string[];
};

/**
 * Evaluate whether a document meets threshold requirements and determine approval steps.
 */
export async function evaluateApprovalPolicy(input: {
  workspaceId: string;
  documentId: string;
  totalAmountCents: number;
  currency: string;
}): Promise<ApprovalResult> {
  const policies = await prisma.approvalPolicy.findMany({
    where: { workspaceId: input.workspaceId, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });

  const applicablePolicy = policies.find(
    (p) => p.minAmountCents === null || p.minAmountCents <= input.totalAmountCents
  );

  if (!applicablePolicy) {
    // No policy required - auto-approve
    return { approved: true, completed: true, requiredApprovers: [] };
  }

  // Create approval steps for the document
  for (const step of applicablePolicy.steps) {
    await prisma.approvalStep.create({
      data: {
        id: crypto.randomUUID(),
        policyId: applicablePolicy.id,
        documentId: input.documentId,
        order: step.order,
        approverRoleId: step.approverRoleId,
        status: 'pending',
      },
    });
  }

  const firstStep = applicablePolicy.steps[0];
  return {
    approved: false,
    nextStep: firstStep?.id,
    completed: false,
    requiredApprovers: applicablePolicy.steps.map((s) => s.approverRoleId),
  };
}

/**
 * Record an approval decision for a step.
 */
export async function recordApprovalStep(input: {
  stepId: string;
  approverId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
}): Promise<{ success: boolean; nextStep?: string; completed: boolean }> {
  const step = await prisma.approvalStep.findUnique({
    where: { id: input.stepId },
    include: { policy: { include: { steps: { orderBy: { order: 'asc' } } } } },
  });

  if (!step) throw ApiError.notFound('Approval step not found');
  if (step.status !== 'pending') throw ApiError.badRequest('Step already decided');

  await prisma.approvalStep.update({
    where: { id: input.stepId },
    data: {
      status: input.decision,
      approvedById: input.approverId,
      approvedAt: input.decision === 'approved' ? new Date() : null,
      rejectedAt: input.decision === 'rejected' ? new Date() : null,
      notes: input.comment,
    },
  });

  if (input.decision === 'rejected') {
    // Mark all subsequent steps as skipped
    await prisma.approvalStep.updateMany({
      where: {
        documentId: step.documentId,
        order: { gt: step.order },
        status: 'pending',
      },
      data: { status: 'skipped' },
    });
    return { success: true, completed: true };
  }

  // Find next step
  const nextStep = step.policy.steps.find((s) => s.order === step.order + 1);
  if (!nextStep) {
    // All steps approved
    return { success: true, completed: true };
  }

  // Activate next step
  await prisma.approvalStep.update({
    where: { id: step.id },
    data: { status: 'completed' },
  });

  const nextApprovalStep = await prisma.approvalStep.findFirst({
    where: { documentId: step.documentId, order: step.order + 1, status: 'pending' },
  });

  return { success: true, nextStep: nextApprovalStep?.id, completed: false };
}

/**
 * Get pending approvals for a user.
 */
export async function getPendingApprovals(userId: string, workspaceId: string) {
  return prisma.approvalStep.findMany({
    where: {
      approvedById: userId,
      status: 'pending',
      document: { workspaceId },
    },
    include: {
      document: true,
      policy: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}