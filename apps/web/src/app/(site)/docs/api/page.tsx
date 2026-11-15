import type { Metadata } from 'next';
import { buildOpenApiDocument } from '@/lib/api/openapi';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'API reference',
  description: 'Versioned REST API for ParsePilot document extraction, jobs, exports, billing and privacy controls.',
};

type Operation = { tags?: string[]; summary?: string; description?: string };
type Spec = {
  info: { title: string; version: string; description?: string };
  tags: { name: string; description?: string }[];
  paths: Record<string, Record<string, Operation>>;
};

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete'];

export default function ApiDocsPage() {
  const spec = buildOpenApiDocument() as unknown as Spec;
  const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods)
      .filter(([method]) => METHOD_ORDER.includes(method))
      .map(([method, operation]) => ({ path, method, operation })),
  );

  const grouped = spec.tags
    .map((tag) => ({
      ...tag,
      operations: operations.filter((entry) => entry.operation.tags?.includes(tag.name)),
    }))
    .filter((tag) => tag.operations.length > 0);

  return (
    <div className="container">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Developers</p>
        <h1 className={styles.title}>REST API reference</h1>
        <p className={styles.lede}>{spec.info.description}</p>
        <div className={styles.heroMeta}>
          <span className={styles.chip}>OpenAPI {spec.info.version}</span>
          <span className={styles.chip}>Base path /api/v1</span>
          <span className={styles.chip}>{operations.length} operations</span>
          <span className={styles.chip}>JSON envelope · requestId</span>
        </div>
        <a className={styles.download} href="/api/v1/openapi">
          Download the OpenAPI 3.1 document →
        </a>
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="API sections">
          <span className={styles.tocTitle}>Sections</span>
          <a className={styles.tocLink} href="#conventions">
            Conventions
          </a>
          {grouped.map((tag) => (
            <a key={tag.name} className={styles.tocLink} href={`#${tag.name.toLowerCase()}`}>
              {tag.name}
            </a>
          ))}
        </nav>

        <div className={styles.content}>
          <section className={styles.section} id="conventions">
            <h2 className={styles.sectionTitle}>Conventions</h2>
            <p className={styles.sectionBody}>
              Every response is wrapped as <code className={styles.code}>{'{ data, meta }'}</code>. Errors use{' '}
              <code className={styles.code}>{'{ error: { code, message, details }, requestId }'}</code> and always include
              the correlation id. Send <code className={styles.code}>x-workspace-id</code> for workspace-scoped calls;
              membership is verified server-side on every request. Cookie-authenticated mutations also require the{' '}
              <code className={styles.code}>x-csrf-token</code> header matching the <code className={styles.code}>pp_csrf</code>{' '}
              cookie.
            </p>
            <p className={styles.sectionBody}>
              Lists accept <code className={styles.code}>page</code> and <code className={styles.code}>pageSize</code>{' '}
              (maximum 100) and return pagination metadata. Authenticated endpoints are rate limited per user and route,
              with <code className={styles.code}>429</code> and <code className={styles.code}>Retry-After</code> when the
              budget is exhausted.
            </p>
            <p className={styles.sectionBody}>Document processing uses these exact status values:</p>
            <div className={styles.statusList}>
              {[
                'uploaded',
                'queued',
                'extracting_text',
                'running_ocr',
                'extracting_fields',
                'validating',
                'detecting_duplicates',
                'completed',
                'needs_review',
                'failed',
              ].map((status) => (
                <span key={status} className={styles.status}>
                  {status}
                </span>
              ))}
            </div>
            <div className={styles.note}>
              Internal service endpoints under <code className={styles.code}>/internal/*</code> are not part of the public
              API. They are listed here for operators and require the shared internal token; they must never be exposed to
              a browser.
            </div>
          </section>

          {grouped.map((tag) => (
            <section key={tag.name} className={styles.section} id={tag.name.toLowerCase()}>
              <h2 className={styles.sectionTitle}>{tag.name}</h2>
              {tag.description ? <p className={styles.sectionBody}>{tag.description}</p> : null}
              <div className={styles.endpoints}>
                {tag.operations.map((entry) => (
                  <div key={`${entry.method}-${entry.path}`} className={styles.endpoint}>
                    <span className={`${styles.method} ${styles[entry.method] ?? ''}`}>{entry.method.toUpperCase()}</span>
                    <div>
                      <p className={styles.path}>{entry.path}</p>
                      {entry.operation.summary ? <p className={styles.summary}>{entry.operation.summary}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
