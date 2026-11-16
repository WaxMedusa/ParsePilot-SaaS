import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withApi } from '@/lib/http/handler';
import { created } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { createWorkspaceForUser } from '@/lib/workspaces/service';
import { recordAudit } from '@/lib/audit';
import { increment } from '@/lib/observability/metrics';
import { sendEmailVerification } from '@/lib/auth/email-verification';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
  workspaceName: z.string().trim().min(2).max(80).optional(),
});

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const policy = validatePasswordPolicy(body.password);
    if (!policy.ok) throw ApiError.validation(policy.problems.map((problem) => ({ path: 'password', message: problem })));

    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const passwordHash = await hashPassword(body.password);
    const workspaceName = body.workspaceName ?? (body.name ? `${body.name.split(' ')[0]}'s workspace` : 'My workspace');

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name ?? null,
        passwordHash,
      },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });

    const workspace = await createWorkspaceForUser({
      name: workspaceName,
      userId: user.id,
      billingEmail: user.email,
    });

    const session = await createSession(user.id, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipHash: context.ipHash,
    });
    await setSessionCookie(session.token, session.expiresAt);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await recordAudit({
      action: 'auth.signup',
      workspaceId: workspace.id,
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      ipHash: context.ipHash,
      requestId: context.requestId,
    });
    await increment('auth_signups');
    const verification = await sendEmailVerification(user);

    return created(
      {
        user: { id: user.id, email: user.email, name: user.name },
        workspace,
        sessionExpiresAt: session.expiresAt.toISOString(),
        emailVerification: {
          required: !verification.alreadyVerified,
          sent: verification.sent,
          ...(verification.developmentVerificationUrl
            ? { developmentVerificationUrl: verification.developmentVerificationUrl }
            : {}),
        },
      },
      { requestId: context.requestId, headers: { 'Cache-Control': 'no-store' } },
    );
  },
  { auth: 'none', rateLimit: { limit: 8, windowMs: 10 * 60 * 1000, per: 'ip' } },
);
