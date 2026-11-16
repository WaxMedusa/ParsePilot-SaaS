import { appConfig } from '../env';
import { logger } from '../logger';

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
              'x-postmark-server-token': appConfig.email.postmarkToken,
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
