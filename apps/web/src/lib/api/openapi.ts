/**
 * OpenAPI 3.1 description of the ParsePilot REST API. Served at
 * /api/v1/openapi and rendered at /docs/api.
 */

const errorSchema = {
  type: 'object',
  required: ['error', 'requestId'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', examples: ['validation_failed'] },
        message: { type: 'string' },
        details: {},
      },
    },
    requestId: { type: 'string', format: 'uuid' },
  },
} as const;

const documentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    originalName: { type: 'string' },
    status: {
      type: 'string',
      enum: ['uploaded', 'queued', 'extracting_text', 'running_ocr', 'extracting_fields', 'validating', 'detecting_duplicates', 'completed', 'needs_review', 'failed'],
    },
    kind: {
      type: 'string',
      enum: ['invoice', 'receipt', 'purchase_order', 'credit_note', 'bank_statement', 'contract', 'other', 'unknown'],
    },
    pageCount: { type: 'integer', nullable: true },
    sizeBytes: { type: 'integer' },
    mimeType: { type: 'string' },
    duplicateOfId: { type: 'string', format: 'uuid', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    totalAmount: { type: 'string', nullable: true },
    currency: { type: 'string', nullable: true },
    vendorName: { type: 'string', nullable: true },
  },
} as const;

const jobSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['document_process', 'export_generate', 'retention_sweep'] },
    status: { type: 'string', enum: ['queued', 'running', 'succeeded', 'failed', 'dead_letter', 'cancelled'] },
    stage: { type: 'string', nullable: true },
    attempts: { type: 'integer' },
    maxAttempts: { type: 'integer' },
    errorCode: { type: 'string', nullable: true },
    errorCategory: { type: 'string', nullable: true },
    correlationId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const envelope = (dataRef: Record<string, unknown>) => ({
  type: 'object',
  properties: { data: dataRef, meta: { type: 'object', additionalProperties: true } },
});

function errorResponse(description: string) {
  return { description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
}

function jsonResponse(description: string, schema: Record<string, unknown>) {
  return { description, content: { 'application/json': { schema } } };
}

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ParsePilot API',
      version: '1.0.0',
      summary: 'AI-assisted document data extraction for finance teams.',
      description:
        'Versioned REST API. All authenticated endpoints require either a session cookie (with the X-CSRF-Token header for mutations) or an `Authorization: Bearer <session token>` header. Documents are always scoped to the workspace resolved from `x-workspace-id` or `workspaceId`, and membership is verified server-side.',
      license: { name: 'Proprietary' },
    },
    servers: [{ url: '/api/v1', description: 'This deployment' }],
    tags: [
      { name: 'Auth', description: 'Registration, sessions and password reset.' },
      { name: 'Documents', description: 'Upload, inspect, correct, reprocess and delete documents.' },
      { name: 'Jobs', description: 'Processing job status and retries.' },
      { name: 'Exports', description: 'Asynchronous CSV/XLSX exports.' },
      { name: 'Billing', description: 'Subscription, usage and Stripe webhooks.' },
      { name: 'Privacy', description: 'Data export, deletion and session controls.' },
      { name: 'Internal', description: 'Service-to-service endpoints (shared-token protected).' },
      { name: 'System', description: 'Health, readiness and API description.' },
    ],
    components: {
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'pp_session' },
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        Error: errorSchema,
        Document: documentSchema,
        Job: jobSchema,
        Usage: {
          type: 'object',
          properties: {
            plan: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                name: { type: 'string' },
                monthlyPageLimit: { type: 'integer' },
                maxUploadMb: { type: 'integer' },
                priceCents: { type: 'integer' },
                currency: { type: 'string' },
              },
            },
            usage: {
              type: 'object',
              properties: {
                periodStart: { type: 'string', format: 'date-time' },
                periodEnd: { type: 'string', format: 'date-time' },
                pagesUsed: { type: 'integer' },
                pagesRemaining: { type: 'integer' },
                percentUsed: { type: 'integer' },
              },
            },
            subscription: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                currentPeriodEnd: { type: 'string', nullable: true },
                cancelAtPeriodEnd: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    security: [{ sessionCookie: [] }, { bearerAuth: [] }],
    paths: {
      '/auth/signup': {
        post: {
          tags: ['Auth'],
          summary: 'Create an account and its first workspace',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 10 },
                    workspaceName: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            201: jsonResponse('Account created', envelope({ type: 'object' })),
            409: errorResponse('Email already registered'),
            422: errorResponse('Validation failed'),
            429: errorResponse('Rate limited'),
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Sign in and receive a session cookie',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
              },
            },
          },
          responses: { 200: jsonResponse('Signed in', envelope({ type: 'object' })), 401: errorResponse('Invalid credentials'), 429: errorResponse('Rate limited') },
        },
      },
      '/auth/logout': { post: { tags: ['Auth'], summary: 'Revoke the current session', responses: { 200: jsonResponse('Signed out', envelope({ type: 'object' })) } } },
      '/auth/session': { get: { tags: ['Auth'], summary: 'Current user, workspaces and CSRF token', responses: { 200: jsonResponse('Session', envelope({ type: 'object' })), 401: errorResponse('Unauthenticated') } } },
      '/auth/sessions': { get: { tags: ['Auth'], summary: 'List active sessions', responses: { 200: jsonResponse('Sessions', envelope({ type: 'array', items: { type: 'object' } })) } } },
      '/auth/password-reset/request': {
        post: {
          tags: ['Auth'],
          summary: 'Request a password reset',
          security: [],
          description: 'Always returns the same response to avoid account enumeration. Requires a configured transactional email provider in production.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } } } },
          responses: { 200: jsonResponse('Accepted', envelope({ type: 'object' })), 429: errorResponse('Rate limited') },
        },
      },
      '/auth/password-reset/confirm': {
        post: {
          tags: ['Auth'],
          summary: 'Set a new password with a single-use token',
          security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, password: { type: 'string' } } } } } },
          responses: { 200: jsonResponse('Password updated', envelope({ type: 'object' })), 400: errorResponse('Invalid or expired token') },
        },
      },
      '/documents': {
        get: {
          tags: ['Documents'],
          summary: 'List documents in the workspace',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'kind', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'originalName', 'status', 'sizeBytes'] } },
            { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          ],
          responses: { 200: jsonResponse('Documents', envelope({ type: 'array', items: { $ref: '#/components/schemas/Document' } })), 401: errorResponse('Unauthenticated') },
        },
        post: {
          tags: ['Documents'],
          summary: 'Upload a document (multipart/form-data, field "file")',
          description:
            'The server detects the file type from magic bytes, rejects active PDF content, enforces plan size and page limits, stores the file privately with a random key, creates the document record and queues an idempotent processing job.',
          requestBody: {
            required: true,
            content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } },
          },
          responses: {
            201: jsonResponse('Queued', envelope({ type: 'object' })),
            402: errorResponse('Plan limit reached'),
            413: errorResponse('File too large'),
            415: errorResponse('Unsupported file type'),
            422: errorResponse('File quarantined or invalid'),
          },
        },
      },
      '/documents/{id}': {
        get: { tags: ['Documents'], summary: 'Document detail with extraction and jobs', parameters: [idParam], responses: { 200: jsonResponse('Document', envelope({ type: 'object' })), 404: errorResponse('Not found') } },
        patch: {
          tags: ['Documents'],
          summary: 'Update display metadata',
          parameters: [idParam],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { originalName: { type: 'string' }, kind: { type: 'string' } } } } } },
          responses: { 200: jsonResponse('Updated', envelope({ type: 'object' })) },
        },
        delete: { tags: ['Documents'], summary: 'Soft-delete a document and schedule storage purge', parameters: [idParam], responses: { 200: jsonResponse('Deleted', envelope({ type: 'object' })), 404: errorResponse('Not found') } },
      },
      '/documents/{id}/process': {
        post: {
          tags: ['Documents'],
          summary: 'Queue document processing (initial or reprocess)',
          parameters: [idParam],
          responses: { 202: jsonResponse('Queued', envelope({ type: 'object' })), 402: errorResponse('Quota exceeded'), 409: errorResponse('Job already active') },
        },
      },
      '/documents/{id}/retry': {
        post: { tags: ['Documents'], summary: 'Retry the latest failed job', parameters: [idParam], responses: { 202: jsonResponse('Retried', envelope({ type: 'object' })), 409: errorResponse('No failed job') } },
      },
      '/documents/{id}/status': { get: { tags: ['Documents'], summary: 'Lightweight processing status for polling', parameters: [idParam], responses: { 200: jsonResponse('Status', envelope({ type: 'object' })) } } },
      '/documents/{id}/download-url': {
        post: { tags: ['Documents'], summary: 'Mint a short-lived signed download URL', parameters: [idParam], responses: { 200: jsonResponse('Signed URL', envelope({ type: 'object' })), 404: errorResponse('Not found') } },
      },
      '/documents/{id}/fields/{fieldId}': {
        patch: {
          tags: ['Documents'],
          summary: 'Correct an extracted field (original value preserved)',
          parameters: [idParam, { name: 'fieldId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { value: { type: 'string', nullable: true } } } } } },
          responses: { 200: jsonResponse('Updated', envelope({ type: 'object' })), 409: errorResponse('Not the latest extraction') },
        },
      },
      '/jobs': {
        get: {
          tags: ['Jobs'],
          summary: 'List processing jobs',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['queued', 'running', 'succeeded', 'failed', 'dead_letter', 'cancelled'] } },
            { name: 'documentId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'page', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: jsonResponse('Jobs', envelope({ type: 'array', items: { $ref: '#/components/schemas/Job' } })) },
        },
      },
      '/jobs/{id}': { get: { tags: ['Jobs'], summary: 'Job detail', parameters: [idParam], responses: { 200: jsonResponse('Job', envelope({ $ref: '#/components/schemas/Job' })), 404: errorResponse('Not found') } } },
      '/exports': {
        get: { tags: ['Exports'], summary: 'List exports', responses: { 200: jsonResponse('Exports', envelope({ type: 'array', items: { type: 'object' } })) } },
        post: {
          tags: ['Exports'],
          summary: 'Create an asynchronous export',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { format: { type: 'string', enum: ['csv', 'xlsx'] }, filters: { type: 'object' } } } } } },
          responses: { 201: jsonResponse('Queued', envelope({ type: 'object' })), 403: errorResponse('Format not included in plan') },
        },
      },
      '/exports/{id}/download': { get: { tags: ['Exports'], summary: 'Signed download for a completed export', parameters: [idParam], responses: { 200: jsonResponse('Signed URL', envelope({ type: 'object' })), 409: errorResponse('Not ready or expired') } } },
      '/usage': { get: { tags: ['Billing'], summary: 'Current usage and limits', responses: { 200: jsonResponse('Usage', envelope({ $ref: '#/components/schemas/Usage' })) } } },
      '/subscription': { get: { tags: ['Billing'], summary: 'Subscription and plan', responses: { 200: jsonResponse('Subscription', envelope({ type: 'object' })) } } },
      '/subscription/checkout': {
        post: {
          tags: ['Billing'],
          summary: 'Create a Stripe checkout session (owner only)',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { planCode: { type: 'string' } } } } } },
          responses: { 200: jsonResponse('Checkout URL', envelope({ type: 'object' })), 503: errorResponse('Billing not configured') },
        },
      },
      '/subscription/portal': { post: { tags: ['Billing'], summary: 'Open the Stripe billing portal (owner only)', responses: { 200: jsonResponse('Portal URL', envelope({ type: 'object' })) } } },
      '/webhooks/stripe': {
        post: {
          tags: ['Billing'],
          summary: 'Stripe webhook receiver',
          security: [],
          description: 'Verifies the Stripe signature and deduplicates events by id. Replayed deliveries are acknowledged without side effects.',
          responses: { 200: jsonResponse('Received', { type: 'object', properties: { received: { type: 'boolean' }, duplicate: { type: 'boolean' } } }), 400: errorResponse('Invalid signature') },
        },
      },
      '/privacy/account': { get: { tags: ['Privacy'], summary: 'Account, sessions and privacy requests', responses: { 200: jsonResponse('Privacy overview', envelope({ type: 'object' })) } } },
      '/privacy/requests': {
        get: { tags: ['Privacy'], summary: 'List data requests', responses: { 200: jsonResponse('Requests', envelope({ type: 'array', items: { type: 'object' } })) } },
        post: {
          tags: ['Privacy'],
          summary: 'Request an account or workspace data export',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['account_export', 'workspace_export'] } } } } } },
          responses: { 201: jsonResponse('Requested', envelope({ type: 'object' })) },
        },
      },
      '/privacy/requests/{id}/download': { get: { tags: ['Privacy'], summary: 'Download a completed data export', parameters: [idParam], responses: { 200: jsonResponse('Signed URL', envelope({ type: 'object' })), 409: errorResponse('Not ready') } } },
      '/privacy/account-deletion': {
        post: {
          tags: ['Privacy'],
          summary: 'Request account deletion (requires password reauthentication)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', required: ['password', 'confirmation', 'deleteWorkspaces'], properties: { password: { type: 'string' }, confirmation: { type: 'string', enum: ['DELETE'] }, deleteWorkspaces: { type: 'boolean' } } },
              },
            },
          },
          responses: { 201: jsonResponse('Scheduled', envelope({ type: 'object' })), 403: errorResponse('Password confirmation failed') },
        },
      },
      '/privacy/account-deletion/cancel': { post: { tags: ['Privacy'], summary: 'Cancel a pending account deletion', responses: { 200: jsonResponse('Cancelled', envelope({ type: 'object' })) } } },
      '/privacy/workspace-deletion': { post: { tags: ['Privacy'], summary: 'Schedule workspace deletion (owner only)', responses: { 201: jsonResponse('Scheduled', envelope({ type: 'object' })) } } },
      '/privacy/sessions/{id}': { delete: { tags: ['Privacy'], summary: 'Revoke an active session', parameters: [idParam], responses: { 200: jsonResponse('Revoked', envelope({ type: 'object' })) } } },
      '/privacy/consent': { post: { tags: ['Privacy'], summary: 'Persist cookie preferences', security: [], responses: { 200: jsonResponse('Stored', envelope({ type: 'object' })) } } },
      '/openapi': { get: { tags: ['System'], summary: 'This OpenAPI document', security: [], responses: { 200: jsonResponse('OpenAPI document', { type: 'object' }) } } },
    },
  } as const;
}
