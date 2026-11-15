export type ApiErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'quota_exceeded'
  | 'subscription_inactive'
  | 'method_not_allowed'
  | 'internal_error'
  | 'service_unavailable'
  | 'csrf_failed'
  | 'origin_rejected';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  /** Safe to show to the caller. Internal errors are never exposed. */
  readonly expose: boolean;

  constructor(status: number, code: ApiErrorCode, message: string, options?: { details?: unknown; expose?: boolean }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.expose = options?.expose ?? true;
  }

  static badRequest(message = 'The request could not be processed', details?: unknown) {
    return new ApiError(400, 'bad_request', message, { details });
  }
  static validation(details?: unknown, message = 'The submitted values are invalid') {
    return new ApiError(422, 'validation_failed', message, { details });
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'unauthorized', message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, 'forbidden', message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'not_found', message);
  }
  static conflict(message = 'The resource is in a conflicting state', details?: unknown) {
    return new ApiError(409, 'conflict', message, { details });
  }
  static rateLimited(retryAfterSeconds: number) {
    return new ApiError(429, 'rate_limited', 'Too many requests. Please try again shortly.', {
      details: { retryAfterSeconds },
    });
  }
  static payloadTooLarge(message = 'The uploaded file exceeds the allowed size') {
    return new ApiError(413, 'payload_too_large', message);
  }
  static unsupportedMediaType(message = 'This file type is not supported') {
    return new ApiError(415, 'unsupported_media_type', message);
  }
  static quotaExceeded(message = 'Your plan page limit has been reached', details?: unknown) {
    return new ApiError(402, 'quota_exceeded', message, { details });
  }
  static subscriptionInactive(message = 'An active subscription is required for this action') {
    return new ApiError(402, 'subscription_inactive', message);
  }
  static internal(message = 'Something went wrong. Please try again.', details?: unknown) {
    return new ApiError(500, 'internal_error', message, { details, expose: false });
  }
  static unavailable(message = 'The service is temporarily unavailable') {
    return new ApiError(503, 'service_unavailable', message);
  }
}
