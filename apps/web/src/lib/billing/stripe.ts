import Stripe from 'stripe';
import { appConfig, appUrl } from '../env';
import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { logger } from '../logger';
import { recordAudit } from '../audit';
import { increment } from '../observability/metrics';

/**
 * Billing integration. Stripe is the payment processor; PostgreSQL remains
 * authoritative for entitlements. Webhooks are signature-verified and
 * deduplicated by event id, so replayed deliveries are harmless.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!appConfig.stripe.secretKey) return null;
  if (!cached) cached = new Stripe(appConfig.stripe.secretKey, { maxNetworkRetries: 2, timeout: 15_000 });
  return cached;
}

export function verifyStripeSignature(rawBody: string, signature: string | null): Stripe.Event {
  const stripe = getStripe();
  if (!stripe || !appConfig.stripe.webhookSecret) {
    throw ApiError.unavailable('Billing webhooks are not configured on this deployment');
  }
  if (!signature) throw ApiError.badRequest('Missing Stripe signature header');
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, appConfig.stripe.webhookSecret);
  } catch (error) {
    throw new ApiError(400, 'validation_failed', 'Invalid Stripe webhook signature', {
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

function readUnix(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

type SubscriptionLike = {
  id?: unknown;
  customer?: unknown;
  status?: unknown;
  cancel_at_period_end?: unknown;
  current_period_start?: unknown;
  current_period_end?: unknown;
  canceled_at?: unknown;
  trial_end?: unknown;
  metadata?: unknown;
  items?: unknown;
};

function subscriptionFields(subscription: SubscriptionLike) {
  const items = subscription.items as { data?: Array<{ current_period_start?: unknown; current_period_end?: unknown; price?: { id?: unknown } }> } | undefined;
  const firstItem = items?.data?.[0];
  return {
    stripeSubscriptionId: readString(subscription.id),
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : readString((subscription.customer as { id?: unknown })?.id),
    status: readString(subscription.status) ?? 'active',
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    currentPeriodStart: readUnix(subscription.current_period_start) ?? readUnix(firstItem?.current_period_start),
    currentPeriodEnd: readUnix(subscription.current_period_end) ?? readUnix(firstItem?.current_period_end),
    canceledAt: readUnix(subscription.canceled_at),
    trialEndsAt: readUnix(subscription.trial_end),
    priceId: readString(firstItem?.price?.id),
    metadata: (subscription.metadata ?? {}) as Record<string, string>,
  };
}

async function planCodeForPrice(priceId: string | null): Promise<string | null> {
  if (!priceId) return null;
  const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId }, select: { code: true } });
  return plan?.code ?? null;
}

const STATUS_MAP: Record<string, 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  unpaid: 'unpaid',
  paused: 'unpaid',
};

/**
 * Applies a Stripe subscription object to the workspace. The workspace is
 * resolved from subscription metadata or the existing subscription row; a
 * webhook can never attach a workspace it was not created for.
 */
export async function syncSubscriptionFromStripe(subscription: SubscriptionLike, fallbackWorkspaceId?: string | null) {
  const fields = subscriptionFields(subscription);
  if (!fields.stripeSubscriptionId) throw ApiError.badRequest('Subscription payload missing id');

  const existing = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: fields.stripeSubscriptionId } });
  const metadataWorkspaceId = readString(fields.metadata.workspaceId);
  const workspaceId = existing?.workspaceId ?? metadataWorkspaceId ?? fallbackWorkspaceId ?? null;
  if (!workspaceId) {
    logger.warn('stripe_subscription_unmapped', { subscriptionId: fields.stripeSubscriptionId });
    return { applied: false };
  }
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) {
    logger.warn('stripe_subscription_unknown_workspace', { subscriptionId: fields.stripeSubscriptionId });
    return { applied: false };
  }

  const mappedStatus = STATUS_MAP[fields.status] ?? 'incomplete';
  const pricePlan = await planCodeForPrice(fields.priceId);
  const planCode = pricePlan ?? existing?.planCode ?? 'free';
  const downgrade = mappedStatus === 'canceled' || mappedStatus === 'unpaid';

  await prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        planCode: downgrade ? 'free' : planCode,
        status: mappedStatus,
        stripeCustomerId: fields.stripeCustomerId,
        stripeSubscriptionId: fields.stripeSubscriptionId,
        currentPeriodStart: fields.currentPeriodStart,
        currentPeriodEnd: fields.currentPeriodEnd,
        cancelAtPeriodEnd: fields.cancelAtPeriodEnd,
        canceledAt: fields.canceledAt,
        trialEndsAt: fields.trialEndsAt,
      },
      update: {
        planCode: downgrade ? 'free' : planCode,
        status: mappedStatus,
        stripeCustomerId: fields.stripeCustomerId ?? undefined,
        currentPeriodStart: fields.currentPeriodStart,
        currentPeriodEnd: fields.currentPeriodEnd,
        cancelAtPeriodEnd: fields.cancelAtPeriodEnd,
        canceledAt: fields.canceledAt,
        trialEndsAt: fields.trialEndsAt,
        ...(mappedStatus === 'past_due' ? { lastPaymentFailedAt: new Date() } : {}),
      },
    });
    await tx.workspace.update({ where: { id: workspaceId }, data: { planCode: downgrade ? 'free' : planCode } });
  });

  await recordAudit({
    action: 'billing.subscription_updated',
    workspaceId,
    targetType: 'subscription',
    targetId: fields.stripeSubscriptionId,
    metadata: { status: mappedStatus, planCode: downgrade ? 'free' : planCode, cancelAtPeriodEnd: fields.cancelAtPeriodEnd },
  });
  await increment('billing_subscription_synced', { status: mappedStatus });
  return { applied: true, workspaceId, planCode: downgrade ? 'free' : planCode, status: mappedStatus };
}

export type WebhookOutcome = { handled: boolean; duplicate: boolean; eventId: string; type: string };

/**
 * Processes a verified Stripe event exactly once. The unique stripeEventId is
 * the replay guard; invoice and subscription updates are idempotent upserts.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  const existing = await prisma.billingEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.status === 'processed') {
    return { handled: true, duplicate: true, eventId: event.id, type: event.type };
  }
  await prisma.billingEvent.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      type: event.type,
      status: 'received',
      payloadHash: '',
      attemptCount: 1,
    },
    update: { status: 'received', attemptCount: { increment: 1 }, errorMessage: null },
  });

  try {
    let workspaceId: string | null = null;
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        workspaceId = readString(session.client_reference_id) ?? readString(session.metadata?.workspaceId);
        const stripe = getStripe();
        if (stripe && typeof session.subscription === 'string') {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscriptionFromStripe(subscription as unknown as SubscriptionLike, workspaceId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as unknown as SubscriptionLike;
        const result = await syncSubscriptionFromStripe(subscription);
        workspaceId = 'workspaceId' in result && typeof result.workspaceId === 'string' ? result.workspaceId : null;
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripe = getStripe();
        const subscriptionId = typeof (invoice as unknown as { subscription?: unknown }).subscription === 'string'
          ? ((invoice as unknown as { subscription: string }).subscription)
          : null;
        if (stripe && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const result = await syncSubscriptionFromStripe(subscription as unknown as SubscriptionLike);
          workspaceId = 'workspaceId' in result && typeof result.workspaceId === 'string' ? result.workspaceId : null;
        }
        if (event.type === 'invoice.payment_failed' && workspaceId) {
          await prisma.subscription.updateMany({ where: { workspaceId }, data: { lastPaymentFailedAt: new Date(), status: 'past_due' } });
        }
        break;
      }
      default: {
        await prisma.billingEvent.update({
          where: { stripeEventId: event.id },
          data: { status: 'skipped', processedAt: new Date() },
        });
        logger.info('stripe_event_skipped', { eventId: event.id, type: event.type });
        return { handled: false, duplicate: false, eventId: event.id, type: event.type };
      }
    }

    await prisma.billingEvent.update({
      where: { stripeEventId: event.id },
      data: { status: 'processed', processedAt: new Date(), workspaceId },
    });
    await recordAudit({
      action: 'billing.webhook_processed',
      workspaceId,
      targetType: 'billing_event',
      targetId: event.id,
      metadata: { type: event.type },
    });
    await increment('billing_webhook_processed', { type: event.type });
    logger.info('stripe_event_processed', { eventId: event.id, type: event.type });
    return { handled: true, duplicate: false, eventId: event.id, type: event.type };
  } catch (error) {
    await prisma.billingEvent.update({
      where: { stripeEventId: event.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
      },
    });
    logger.error('stripe_event_failed', { eventId: event.id, type: event.type, message: error instanceof Error ? error.message : 'unknown' });
    throw error;
  }
}

export async function createCheckoutSession(input: { workspaceId: string; planCode: string; userEmail: string }): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw ApiError.unavailable('Billing is not configured on this deployment');
  const plan = await prisma.plan.findUnique({ where: { code: input.planCode } });
  if (!plan || !plan.stripePriceId) throw ApiError.badRequest('This plan is not available for online checkout');
  if (plan.priceCents === 0) throw ApiError.badRequest('The free plan does not require checkout');

  const subscription = await prisma.subscription.findUnique({ where: { workspaceId: input.workspaceId } });
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/dashboard/settings/billing?checkout=cancelled`,
    client_reference_id: input.workspaceId,
    customer: subscription?.stripeCustomerId ?? undefined,
    customer_email: subscription?.stripeCustomerId ? undefined : input.userEmail,
    allow_promotion_codes: true,
    metadata: { workspaceId: input.workspaceId, planCode: plan.code },
    subscription_data: { metadata: { workspaceId: input.workspaceId, planCode: plan.code } },
  });
  if (!session.url) throw ApiError.internal('Stripe did not return a checkout URL');
  await recordAudit({
    action: 'billing.checkout_started',
    workspaceId: input.workspaceId,
    targetType: 'plan',
    targetId: plan.code,
  });
  return { url: session.url };
}

export async function createPortalSession(workspaceId: string): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw ApiError.unavailable('Billing is not configured on this deployment');
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!subscription?.stripeCustomerId) throw ApiError.badRequest('No billing account exists for this workspace');
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/dashboard/settings/billing`,
  });
  await recordAudit({ action: 'billing.portal_opened', workspaceId });
  return { url: session.url };
}
