'use client';

import { useEffect, useRef } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import styles from './ProofDrift.module.css';

type State = 'ok' | 'review' | 'flag' | 'muted';

type Row = { code: string; value: string; state: State };

const FIELDS: Row[] = [
  { code: 'vendor_name', value: 'Atlas Freight GmbH', state: 'ok' },
  { code: 'invoice_number', value: 'INV-8842', state: 'ok' },
  { code: 'issue_date', value: '2026-10-14', state: 'ok' },
  { code: 'due_date', value: '2026-11-14', state: 'review' },
  { code: 'currency', value: 'EUR', state: 'ok' },
  { code: 'subtotal', value: '3597.20', state: 'ok' },
  { code: 'tax_amount', value: '318.20', state: 'review' },
  { code: 'total', value: '3915.40', state: 'ok' },
  { code: 'po_number', value: 'PO-20418', state: 'ok' },
  { code: 'line_items', value: '2 rows', state: 'ok' },
  { code: 'duplicate_of', value: 'INV-8712', state: 'flag' },
  { code: 'confidence', value: '0.62', state: 'review' },
];

const STATES: Row[] = [
  { code: 'uploaded', value: 'quarantine passed', state: 'ok' },
  { code: 'queued', value: 'attempt 1/5', state: 'ok' },
  { code: 'extracting_text', value: '2 pages native', state: 'ok' },
  { code: 'running_ocr', value: 'skipped', state: 'muted' },
  { code: 'extracting_fields', value: 'schema v7', state: 'ok' },
  { code: 'validating', value: 'arithmetic', state: 'ok' },
  { code: 'needs_review', value: '2 fields', state: 'review' },
  { code: 'extraction_v03', value: 'edits kept', state: 'ok' },
  { code: 'billing_ledger', value: 'idempotent', state: 'ok' },
  { code: 'dead_letter', value: 'replayable', state: 'flag' },
  { code: 'retention', value: '30 days', state: 'muted' },
  { code: 'export_ready', value: 'csv · xlsx', state: 'ok' },
];

const TRACES: Row[] = [
  { code: 'page_01', value: 'box 412,88', state: 'ok' },
  { code: 'page_02', value: 'box 96,340', state: 'ok' },
  { code: 'normalise', value: 'date → iso', state: 'ok' },
  { code: 'normalise', value: 'total → minor units', state: 'ok' },
  { code: 'check', value: 'subtotal + tax', state: 'ok' },
  { code: 'check', value: 'duplicate window', state: 'ok' },
  { code: 'edit', value: 'M. Keller 14:32', state: 'ok' },
  { code: 'version', value: 'v02 → v03', state: 'ok' },
  { code: 'audit', value: 'correlation 8f2a', state: 'muted' },
  { code: 'signed_url', value: 'expires in 120s', state: 'muted' },
  { code: 'export', value: '4 columns', state: 'ok' },
  { code: 'retention', value: 'delete on request', state: 'muted' },
];

const COLUMNS = [
  { rows: FIELDS, duration: '84s', reverse: false },
  { rows: STATES, duration: '98s', reverse: true },
  { rows: TRACES, duration: '116s', reverse: false },
];

/**
 * A slow wall of the values, states and traces that leave the pipeline. Rows
 * drift as a single translated rail rather than one animation per row. The
 * band pauses while it is off screen.
 */
export function ProofDrift() {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = section.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        node.dataset.idle = entries.some((entry) => entry.isIntersecting) ? 'false' : 'true';
      },
      { rootMargin: '120px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.section} ref={section} aria-label="Field vocabulary">
      <div className="container">
        <Reveal className={styles.head}>
          <p className="kicker">Field vocabulary</p>
          <p className={styles.note}>Normalised values / job states / source traces</p>
        </Reveal>
      </div>

      <div className={styles.window} aria-hidden="true">
        {COLUMNS.map((column, columnIndex) => (
          <div key={columnIndex} className={styles.column}>
            <ul
              className={column.reverse ? `${styles.track} ${styles.reverse}` : styles.track}
              style={{ animationDuration: column.duration }}
            >
              {[...column.rows, ...column.rows].map((row, index) => (
                <li key={`${index}-${row.code}`} className={styles.row}>
                  <span className={styles.rowCode}>{row.code}</span>
                  <span className={styles.rowValue}>{row.value}</span>
                  <span className={styles.rowState} data-state={row.state} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container">
        <Reveal className={styles.foot} delay={80}>
          <span>Illustrative values</span>
          <span>Every field keeps its page, box and confidence</span>
        </Reveal>
      </div>
    </section>
  );
}
