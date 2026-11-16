import { randomBytes } from 'node:crypto';
import { prisma } from '../prisma';
import { appUrl, isProduction } from '../env';
import { hashToken } from './session';
import { retentionConfig } from '../../config/retention';
import { emailVerificationEmail } from '../email/templates';
import { sendTransactionalEmail } from '../email/service';

type VerificationUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: Date | null;
};

async function issueVerificationToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + retentionConfig.emailVerificationMinutes * 60 * 1000);
  await prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function sendEmailVerification(user: VerificationUser): Promise<{
  sent: boolean;
  alreadyVerified: boolean;
  developmentVerificationUrl?: string;
}> {
  if (user.emailVerifiedAt) return { sent: true, alreadyVerified: true };

  const { token } = await issueVerificationToken(user.id);
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const message = emailVerificationEmail({
    name: user.name,
    verifyUrl,
    expiresMinutes: retentionConfig.emailVerificationMinutes,
  });
  const delivery = await sendTransactionalEmail({ to: user.email, ...message });

  return {
    sent: delivery.sent,
    alreadyVerified: false,
    ...(!isProduction && !delivery.sent ? { developmentVerificationUrl: verifyUrl } : {}),
  };
}

export async function confirmEmailVerification(token: string): Promise<{ userId: string; email: string }> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { email: true } },
    },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new Error('invalid_verification_token');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: now } }),
    prisma.emailVerificationToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: now },
    }),
  ]);
  return { userId: record.userId, email: record.user.email };
}
