import { NextResponse, type NextRequest } from 'next/server';
import { verifyStripeSignature, processStripeEvent } from '@/lib/billing/stripe';
import { errorResponse } from '@/lib/http/respond';
import { getRequestId } from '@/lib/http/request';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/lib/http/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhooks. The raw body is required for signature verification, which
 * happens before any parsing. Event ids are unique in the database, so replaying
 * a delivery is a no-op.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const limit = await enforceRateLimit(`stripe-webhook:${requestId}`, 120, 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: { code: 'rate_limited', message: 'Too many requests' }, requestId }, { status: 429 });
    }
    const signature = request.headers.get('stripe-signature');
    const rawBody = await request.text();
    if (!rawBody || rawBody.length > 512 * 1024) {
      return NextResponse.json({ error: { code: 'bad_request', message: 'Invalid payload' }, requestId }, { status: 400 });
    }

    const event = verifyStripeSignature(rawBody, signature);
    const outcome = await processStripeEvent(event);
    logger.info('stripe_webhook_received', { requestId, eventId: outcome.eventId, type: outcome.type, duplicate: outcome.duplicate });
    return NextResponse.json({ received: true, duplicate: outcome.duplicate }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
