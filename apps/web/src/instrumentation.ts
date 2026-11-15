/**
 * Next.js instrumentation hook. A production server refuses to start while
 * required legal details are still placeholders: shipping unresolved legal
 * pages would misrepresent the business and its data practices.
 *
 * Next.js runs this hook in both the Node.js and Edge runtimes. It must never
 * throw in Edge: a throwing instrumentation hook is included in the routing
 * middleware bundle, and on Vercel that surfaces as MIDDLEWARE_INVOCATION_FAILED
 * for every route, including the public marketing site. Vercel preview
 * deployments are review environments, not commercial launches, so they render
 * the draft legal pages. A production deployment still refuses to start until
 * the legal details are complete, unless LEGAL_GATE_MODE=warn is explicitly set
 * for a non-public demonstration.
 */
export async function register() {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { listOutstandingPlaceholders } = await import('./config/legal');
  const outstanding = listOutstandingPlaceholders();
  if (outstanding.length === 0) return;

  const message =
    `Legal configuration incomplete (${outstanding.length} item(s)). ` +
    'Complete src/config/legal.ts and set legalReviewCompleted=true before starting production. ' +
    `Outstanding: ${outstanding.slice(0, 5).join('; ')}`;

  if (process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development') {
    console.warn(`[legal] ${message}`);
    return;
  }

  if (process.env.LEGAL_GATE_MODE === 'warn') {
    console.warn(`[legal] ${message}`);
    return;
  }

  throw new Error(message);
}
