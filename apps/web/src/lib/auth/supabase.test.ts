import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifySupabaseAccessToken } from './supabase';

const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_ANON_KEY;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('verifySupabaseAccessToken', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'public-test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalKey;
  });

  it('returns the confirmed identity and sends the access token to Supabase', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'Alex@Example.com',
        email_confirmed_at: '2026-11-16T00:00:00Z',
        user_metadata: { full_name: 'Alex Morgan' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const identity = await verifySupabaseAccessToken('access-token');

    expect(identity).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alex@example.com',
      name: 'Alex Morgan',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://demo.supabase.co/auth/v1/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'public-test-key',
          authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('rejects an identity whose email is not confirmed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alex@example.com',
      email_confirmed_at: null,
      user_metadata: {},
    })));

    await expect(verifySupabaseAccessToken('access-token')).resolves.toBeNull();
  });

  it('rejects an invalid or expired access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'invalid token' }, 401)));

    await expect(verifySupabaseAccessToken('bad-token')).resolves.toBeNull();
  });

  it('reports a temporary verification failure without exposing internals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'unavailable' }, 503)));

    await expect(verifySupabaseAccessToken('access-token')).rejects.toMatchObject({
      status: 503,
      code: 'service_unavailable',
    });
  });
});