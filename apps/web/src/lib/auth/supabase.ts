import { z } from 'zod';
import { isProduction, optionalEnv } from '../env';
import { ApiError } from '../http/errors';

const supabaseUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().trim().email().max(254),
  email_confirmed_at: z.string().nullable().optional(),
  confirmed_at: z.string().nullable().optional(),
  user_metadata: z.record(z.unknown()).nullable().optional(),
});

export type SupabaseIdentity = {
  id: string;
  email: string;
  name: string;
};

/**
 * Supabase Auth is the identity provider for Google sign-in. The project URL
 * and publishable key are public client configuration; the service_role key is
 * never used by the web app.
 */
function supabaseAuthConfig(): { url: string; anonKey: string } {
  const rawUrl = optionalEnv('SUPABASE_URL', optionalEnv('NEXT_PUBLIC_SUPABASE_URL'));
  const anonKey = optionalEnv(
    'SUPABASE_ANON_KEY',
    optionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', optionalEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')),
  );

  if (!rawUrl || !anonKey) {
    throw ApiError.unavailable('Google sign-in is not configured for this deployment');
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw ApiError.unavailable('Google sign-in is not configured correctly');
  }

  if (isProduction && url.protocol !== 'https:') {
    throw ApiError.unavailable('Google sign-in requires HTTPS');
  }

  return { url: url.origin, anonKey };
}

function readName(metadata: Record<string, unknown> | null | undefined, email: string): string {
  const candidate = metadata?.full_name ?? metadata?.name ?? metadata?.preferred_username;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim().replace(/\s+/g, ' ').slice(0, 120);
  }
  return email.split('@')[0]?.slice(0, 120) || 'ParsePilot user';
}

/**
 * Verifies a Supabase access token against the project's Auth server. The
 * returned email must be confirmed; Google identities are confirmed by
 * Supabase before this endpoint is reached.
 */
export async function verifySupabaseAccessToken(accessToken: string): Promise<SupabaseIdentity | null> {
  const { url, anonKey } = supabaseAuthConfig();

  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw ApiError.unavailable('Google sign-in verification is temporarily unavailable');
  }

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw ApiError.unavailable('Google sign-in verification is temporarily unavailable');
  }

  const parsed = supabaseUserSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return null;

  const user = parsed.data;
  if (!user.email_confirmed_at && !user.confirmed_at) return null;

  const email = user.email.toLowerCase();
  return {
    id: user.id,
    email,
    name: readName(user.user_metadata, email),
  };
}
