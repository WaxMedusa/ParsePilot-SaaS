'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';
import { FIELD_BY_KEY, FIELD_DEFINITIONS } from '@/lib/documents/fields';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './FieldEditor.module.css';

export type EditableField = {
  id: string;
  key: string;
  value: string | null;
  originalValue: string | null;
  normalizedValue: string | null;
  editedValue: string | null;
  confidence: number | null;
  valueType: string;
  editedAt: string | null;
};

const GROUP_LABEL: Record<string, string> = {
  identity: 'Document',
  parties: 'Parties',
  dates: 'Dates',
  amounts: 'Amounts',
  payment: 'Payment',
  line_items: 'Line items',
  other: 'Other',
};

export function FieldEditor({
  documentId,
  workspaceId,
  fields,
  canEdit,
  version,
}: {
  documentId: string;
  workspaceId: string;
  fields: EditableField[];
  canEdit: boolean;
  version: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, EditableField[]>();
    const ordered = [...fields].sort((a, b) => {
      const indexA = FIELD_DEFINITIONS.findIndex((definition) => definition.key === a.key);
      const indexB = FIELD_DEFINITIONS.findIndex((definition) => definition.key === b.key);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
    for (const field of ordered) {
      const group = FIELD_BY_KEY.get(field.key)?.group ?? 'other';
      const list = byGroup.get(group) ?? [];
      list.push(field);
      byGroup.set(group, list);
    }
    return Array.from(byGroup.entries());
  }, [fields]);

  const startEdit = (field: EditableField) => {
    setEditing(field.id);
    setDraft(field.value ?? '');
    setError(null);
  };

  const save = async (field: EditableField) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/documents/${documentId}/fields/${field.id}`, {
        method: 'PATCH',
        workspaceId,
        body: { value: draft === '' ? null : draft },
      });
      setEditing(null);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  if (fields.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No structured fields yet</p>
        <p className={styles.emptyBody}>
          Fields appear after the processing pipeline completes. If the document failed, check the job timeline for the
          error and retry it.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topline}>
        <span className={styles.version}>{version ? `Extraction version ${version}` : 'Latest extraction'}</span>
        <span className={styles.hint}>Original values are preserved. Edits are attributed and audited.</span>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}

      {grouped.map(([group, groupFields]) => (
        <div key={group} className={styles.group}>
          <p className={styles.groupLabel}>{GROUP_LABEL[group] ?? group}</p>
          <div className={styles.list}>
            {groupFields.map((field) => {
              const definition = FIELD_BY_KEY.get(field.key);
              const isEditing = editing === field.id;
              const confidencePercent = field.confidence === null ? null : Math.round(field.confidence * 100);
              return (
                <div key={field.id} className={styles.row}>
                  <div className={styles.labelCell}>
                    <span className={styles.label}>{definition?.label ?? field.key.replace(/_/g, ' ')}</span>
                    <span className={styles.key}>{field.key}</span>
                  </div>

                  <div className={styles.valueCell}>
                    {isEditing ? (
                      <div className={styles.editRow}>
                        <input
                          className={`${styles.input} ${field.valueType === 'date' ? styles.mono : ''}`}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          autoFocus
                          aria-label={`Value for ${definition?.label ?? field.key}`}
                        />
                        <button type="button" className={styles.saveButton} onClick={() => save(field)} disabled={saving}>
                          <Check size={12} /> {saving ? 'Saving' : 'Save'}
                        </button>
                        <button type="button" className={styles.cancelButton} onClick={() => setEditing(null)} disabled={saving} aria-label="Cancel edit">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.valueRow}>
                        <span className={`${styles.value} ${field.valueType === 'date' || field.valueType === 'decimal' ? 'mono' : ''}`}>
                          {field.value ?? <span className={styles.missing}>Not found</span>}
                        </span>
                        {field.editedValue !== null ? <span className={styles.editedTag}>edited</span> : null}
                        {canEdit ? (
                          <button type="button" className={styles.editButton} onClick={() => startEdit(field)} aria-label={`Edit ${definition?.label ?? field.key}`}>
                            <Pencil size={11} />
                          </button>
                        ) : null}
                      </div>
                    )}
                    {field.editedValue !== null && field.originalValue !== null && field.originalValue !== field.editedValue ? (
                      <p className={styles.original}>Extracted: {field.originalValue}</p>
                    ) : null}
                  </div>

                  <div className={styles.confidenceCell}>
                    {confidencePercent === null ? (
                      <span className={styles.confidenceEmpty}>—</span>
                    ) : (
                      <>
                        <span className={styles.confidenceLabel}>{confidencePercent}%</span>
                        <span className={styles.confidenceBar} aria-hidden="true">
                          <span
                            className={styles.confidenceFill}
                            style={{ width: `${confidencePercent}%`, background: confidencePercent < 60 ? 'var(--color-warning)' : 'var(--color-success)' }}
                          />
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
