import { appConfig } from '../env';
import { logger } from '../logger';
import type { InboundEmailMessage } from '@prisma/client';

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailDeliveryResult = {
  sent: boolean;
  reason?: 'not_configured' | 'provider_error';
};

// ============================================================================
// Feature 1: Inbound Email-to-Invoice Gateway
// ============================================================================

export type InboundEmailInput = {
  workspaceSlug: string;
  fromEmail: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  headers?: Record<string, string>;
  messageId: string;
  requestId: string;
};

export async function processInboundEmail(input: InboundEmailInput) {
  const { prisma } = await import('../prisma');
  const { createDocumentFromUpload } = await import('../documents/service');
  const { ApiError } = await import('../http/errors');

  // 1. Resolve workspace by slug
  const workspace = await prisma.workspace.findUnique({
    where: { slug: input.workspaceSlug },
  });

  if (!workspace) {
    throw ApiError.notFound(`Workspace with slug "${input.workspaceSlug}" not found`);
  }

  // 2. Find a user to attribute upload to (owner or admin, or first member)
  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      role: { in: ['owner', 'admin', 'member'] },
    },
    orderBy: { createdAt: 'asc' },
    include: { user: true },
  });

  if (!member) {
    throw ApiError.badRequest('Workspace has no active members to attribute email upload');
  }

  // 3. Record InboundEmailMessage
  const inboundEmail = await prisma.inboundEmailMessage.create({
    data: {
      workspaceId: workspace.id,
      messageId: input.messageId,
      fromEmail: input.fromEmail,
      to: `${input.workspaceSlug}@inbound.parsepilot.app`,
      subject: input.subject || '(No Subject)',
      bodyText: input.bodyText || null,
      bodyHtml: input.bodyHtml || null,
      headers: (input.headers ?? {}) as any,
      status: 'received',
    },
  });

  let createdDocument: any = null;
  let createdJob: any = null;

  try {
    const attachments = input.attachments || [];
    // If attachments are present, process the first valid PDF/image attachment
    for (const att of attachments) {
      const filename = att.filename || 'invoice.pdf';
      const contentType = att.contentType ?? 'application/pdf';

      // Decode base64 content
      // Decode base64 content
      let buffer: Buffer | Uint8Array;
      try {
        buffer = Buffer.from(att.content, 'base64');
      } catch {
        continue;
      }

      if (buffer.length === 0) continue;

      // Construct a File-like object for createDocumentFromUpload
      // Convert Buffer to proper ArrayBuffer using Uint8Array
      const uint8 = new Uint8Array(buffer);
      const file = new File([uint8.buffer], filename, { type: contentType });
      const result = await createDocumentFromUpload({
        workspaceId: workspace.id,
        userId: member.userId,
        file,
        correlationId: input.requestId,
        ipHash: 'inbound-email',
      });

      createdDocument = result.document;
      createdJob = result.job;

      // Link the document to the inbound email
      await prisma.inboundEmailMessage.update({
        where: { id: inboundEmail.id },
        data: {
          documentId: createdDocument.id,
          status: 'processed',
        },
      });

      break; // Process first valid invoice attachment for now
    }

    if (!createdDocument) {
      // If no valid attachment found, mark inbound email as processed
      await prisma.inboundEmailMessage.update({
        where: { id: inboundEmail.id },
        data: { status: 'processed' },
      });
    }

    return { inboundEmail, document: createdDocument, job: createdJob };
  } catch (error) {
    await prisma.inboundEmailMessage.update({
      where: { id: inboundEmail.id },
      data: {
        status: 'errored',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

// ============================================================================
// Transactional Email (existing functionality)
// ============================================================================

type EmailProvider = 'resend' | 'postmark';

function resolveProvider(): EmailProvider | null {
  const configured = appConfig.email.provider;
  if (configured === 'none') return null;
  if (configured === 'resend' && appConfig.email.resendApiKey) return 'resend';
  if (configured === 'postmark' && appConfig.email.postmarkToken) return 'postmark';
  if (configured) return null;
  if (appConfig.email.resendApiKey) return 'resend';
  if (appConfig.email.postmarkToken) return 'postmark';
  return null;
}

export function emailConfigured(): boolean {
  return Boolean(resolveProvider() && appConfig.email.from);
}

/**
 * Sends a transactional message. Delivery failures are logged without message
 * contents or recipient addresses and are returned to the caller so auth flows
 * can keep their generic responses intact.
 */
export async function sendTransactionalEmail(message: TransactionalEmail): Promise<EmailDeliveryResult> {
  const provider = resolveProvider();
  if (!provider || !appConfig.email.from) {
    logger.warn('transactional_email_not_configured', { subject: message.subject });
    return { sent: false, reason: 'not_configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response =
      provider === 'resend'
        ? await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${appConfig.email.resendApiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              from: appConfig.email.from,
              to: [message.to],
              subject: message.subject,
              text: message.text,
              html: message.html,
              ...(appConfig.email.replyTo ? { reply_to: appConfig.email.replyTo } : {}),
            }),
            signal: controller.signal,
          })
        : await fetch('https://api.postmarkapp.com/email', {
            method: 'POST',
            headers: {
              'x-postmark-server-token': appConfig.email.postmarkToken!,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              From: appConfig.email.from,
              To: message.to,
              Subject: message.subject,
              TextBody: message.text,
              HtmlBody: message.html,
              MessageStream: 'outbound',
              ...(appConfig.email.replyTo ? { ReplyTo: appConfig.email.replyTo } : {}),
            }),
            signal: controller.signal,
          });

    if (!response.ok) {
      logger.error('transactional_email_failed', { provider, status: response.status, subject: message.subject });
      return { sent: false, reason: 'provider_error' };
    }
    logger.info('transactional_email_sent', { provider, subject: message.subject });
    return { sent: true };
  } catch (error) {
    logger.error('transactional_email_failed', {
      provider,
      subject: message.subject,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return { sent: false, reason: 'provider_error' };
  } finally {
    clearTimeout(timeout);
  }
}