import { NextRequest, NextResponse } from 'next/server';
import { getRequestId } from '@/lib/http/request';
import { processInboundEmail } from '@/lib/email/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inbound email webhook endpoint for processing emails sent to the unique
 * workspace email address (e.g., invoices@acme.parsepilot.app).
 *
 * Expected to be called by SendGrid Inbound Parse or Postmark Email Webhook.
 * The email address format is determined by workspace subdomain.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const body = await request.json();

    // Extract workspace from email address (format: <slug>@inbound.parsepilot.app)
    const fromEmail = body.from_email || body.from || '';
    const toEmail = body.to_email || body.to || '';

    // Parse workspace slug from the inbound email address
    // Expected format: <slug>@inbound.parsepilot.app or <slug>@<workspace>.parsepilot.app
    const workspaceMatch = toEmail.match(/^([^@]+)@/);
    if (!workspaceMatch) {
      return NextResponse.json(
        { error: { code: 'bad_request', message: 'Invalid inbound email address' }, requestId },
        { status: 400 },
      );
    }

    const workspaceSlug = workspaceMatch[1];

    // Process the email
    const result = await processInboundEmail({
      workspaceSlug,
      fromEmail,
      subject: body.subject || '',
      bodyHtml: body.html || body.body_html,
      bodyText: body.text || body.body_text,
      attachments: body.attachments || [],
      headers: body.headers,
      messageId: body.message_id || `${fromEmail}-${Date.now()}`,
      requestId,
    });

    return NextResponse.json(
      {
        received: true,
        documentId: result?.document?.id || null,
        jobId: result?.job?.id || null,
      },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    console.error('Inbound email processing error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to process email' }, requestId },
      { status: 500 },
    );
  }
}