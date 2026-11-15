/**
 * Next.js instrumentation hook. A production server refuses to start while
 * required legal details are still placeholders: shipping unresolved legal
 * pages would misrepresent the business and its data practices.
 */
export async function register() {
  if (process.env.NODE_ENV !== 'production') return;
  const { listOutstandingPlaceholders } = await import('./config/legal');
  const outstanding = listOutstandingPlaceholders();
  if (outstanding.length > 0) {
    throw new Error(
      `Legal configuration incomplete (${outstanding.length} item(s)). ` +
        'Complete src/config/legal.ts and set legalReviewCompleted=true before starting production. ' +
        `Outstanding: ${outstanding.slice(0, 5).join('; ')}`,
    );
  }
}
