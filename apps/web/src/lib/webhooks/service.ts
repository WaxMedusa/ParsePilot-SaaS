import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { createHash } from 'node:crypto';

export type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listWebhookEndpoints(workspaceId: string): Promise<WebhookEndpoint[]> {
  return prisma.webhookEndpoint.findMany({
    where: { workspaceId, active: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getWebhookEndpoint(id: string, workspaceId: string): Promise<WebhookEndpoint | null> {
  return prisma.webhookEndpoint.findFirst({
    where: { id, workspaceId, active: true },
  });
}

export async function createWebhookEndpoint(params: {
  workspaceId: string;
  userId: string;
  name: string;
  url: string;
  events: string[];
  active?: boolean;
  requestId: string;
}): Promise<WebhookEndpoint> {
  // Generate a secret key for HMAC signing using crypto
  const secretKey = createHash('sha256')
    .update(`${params.requestId}-${Date.now()}`)
    .digest('hex')
    .slice(0, 32);

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      name: params.name,
      url: params.url,
      events: params.events,
      active: params.active ?? true,
      secretKey,
    },
  });

  return {
    id: endpoint.id,
    name: endpoint.name,
    url: endpoint.url,
    events: endpoint.events,
    active: endpoint.active,
    lastTriggeredAt: endpoint.lastTriggeredAt,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}

export async function updateWebhookEndpoint(
  id: string,
  workspaceId: string,
  data: { name?: string; url?: string; events?: string[]; active?: boolean }
): Promise<WebhookEndpoint> {
  const endpoint = await prisma.webhookEndpoint.updateMany({
    where: { id, workspaceId },
    data,
  });

  if (endpoint.count === 0) throw ApiError.notFound('Webhook endpoint not found');

  return prisma.webhookEndpoint.findFirstOrThrow({ where: { id, workspaceId } });
}

export async function deleteWebhookEndpoint(id: string, workspaceId: string): Promise<void> {
  await prisma.webhookEndpoint.updateMany({
    where: { id, workspaceId },
    data: { active: false },
  });
}

export type WebhookEvent = {
  id: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
};

export async function createWebhookEvent(params: {
  workspaceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  endpointIds: string[];
}): Promise<WebhookEvent[]> {
  const events = await Promise.all(
    params.endpointIds.map(async (endpointId) => {
      const endpoint = await prisma.webhookEndpoint.findFirst({
        where: { id: endpointId, workspaceId: params.workspaceId, active: true, events: { has: params.eventType } },
      });

      if (!endpoint) return null;

      // Generate HMAC signature using crypto
      const timestamp = Date.now();
      const signature = endpoint.secretKey
        ? `v1=${createHash('sha256')
            .update(JSON.stringify({ t: timestamp, data: params.payload }))
            .digest('hex')}${endpoint.secretKey}`
        : undefined;

      const event = await prisma.webhookEvent.create({
        data: {
          id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          endpointId,
          eventType: params.eventType,
          payload: params.payload as any,
          status: 'pending',
        },
      });

      return {
        id: event.id,
        endpointId: event.endpointId,
        eventType: event.eventType,
        payload: event.payload as Record<string, unknown>,
        status: event.status,
        attempts: event.attempts,
        lastStatusCode: event.lastStatusCode,
        lastError: event.lastError,
      };
    }),
  );

  return events.filter((e): e is WebhookEvent => e !== null);
}