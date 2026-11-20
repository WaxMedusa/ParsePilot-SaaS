'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './Dashboard.module.css';

type AiSettingsView = {
  configured: boolean;
  encryptionAvailable: boolean;
  enabled: boolean;
  baseUrl: string;
  model: string;
  keyHint: string | null;
  updatedAt: string | null;
};

type Props = {
  workspaceId: string;
  role: string;
  initial: AiSettingsView;
};

export function AiSettingsPanel({ workspaceId, role, initial }: Props) {
  const router = useRouter();
  const canManage = role === 'owner' || role === 'admin';
  const [view, setView] = useState(initial);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      const next = await apiRequest<AiSettingsView>(`/api/v1/workspaces/${workspaceId}/ai-settings`, {
        method: 'PUT',
        body: { enabled, baseUrl, model, apiKey: apiKey || undefined },
      });
      setView(next);
      setApiKey('');
      setNotice('AI provider settings saved. New documents will use them.');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove the stored provider key for this workspace? This workspace will stop using its own provider.')) {
      return;
    }
    setBusy('remove');
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/ai-settings`, { method: 'DELETE' });
      setView({ ...view, configured: false, keyHint: null, updatedAt: null });
      setApiKey('');
      setNotice('Provider key removed. This workspace no longer has its own provider.');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const benefits = [
    {
      index: '01',
      title: 'Reads past the labels',
      body: 'The model reads the whole page, so remit-to blocks, purchase-order numbers and line-item descriptions get values that label matching alone leaves blank.',
    },
    {
      index: '02',
      title: 'Rules still have the last word',
      body: 'Totals, dates and currencies are normalised and checked, and uncertain documents still route to your review queue instead of being trusted.',
    },
    {
      index: '03',
      title: 'Your key, your provider account',
      body: 'Document text goes to the provider you chose, under your own agreement. The key is encrypted at rest and only its last four characters are shown.',
    },
  ];

  return (
    <div className={styles.stack}>
      <div className={styles.grid3}>
        {benefits.map((benefit) => (
          <div key={benefit.index} className={styles.benefit}>
            <span className={styles.benefitIndex}>{benefit.index}</span>
            <span className={styles.benefitTitle}>{benefit.title}</span>
            <span className={styles.benefitBody}>{benefit.body}</span>
          </div>
        ))}
      </div>

      <div className={styles.split}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Provider</span>
          {view.configured ? <Badge tone="success">Key {view.keyHint}</Badge> : <Badge>Rules only</Badge>}
        </div>
        <form className={styles.cardBody} onSubmit={save}>
          {error ? (
            <div className={`${styles.notice} ${styles.noticeDanger}`} role="alert" style={{ marginBottom: 12 }}>
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status" style={{ marginBottom: 12 }}>
              {notice}
            </div>
          ) : null}
          {!view.encryptionAvailable ? (
            <div className={`${styles.notice} ${styles.noticeWarning}`} role="note" style={{ marginBottom: 12 }}>
              Provider key storage is not configured on this deployment. An administrator must set{' '}
              <code>SETTINGS_ENCRYPTION_KEY</code> before keys can be saved.
            </div>
          ) : null}
          {!view.configured && view.encryptionAvailable ? (
            <div className={`${styles.notice} ${styles.noticeInfo}`} role="note" style={{ marginBottom: 12 }}>
              <div>
                <span className={styles.noticeTitle}>This workspace is rules-only.</span>{' '}
                <span className={styles.noticeBody}>
                  Add a provider key below and every new document also gets a model read. About two minutes, one key,
                  and it stays yours.
                </span>
              </div>
            </div>
          ) : null}
          {!canManage ? (
            <div className={`${styles.notice} ${styles.noticeInfo}`} role="note" style={{ marginBottom: 12 }}>
              Only a workspace owner or admin can change these settings.
            </div>
          ) : null}

          <div className={styles.formRow}>
            <label className={styles.label} htmlFor="ai-base-url">
              Provider URL
            </label>
            <input
              id="ai-base-url"
              className={styles.input}
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
              required
              disabled={!canManage}
            />
            <span className={styles.hint}>
              Any OpenAI-compatible endpoint, HTTPS only. Gemini serves one at{' '}
              <code>https://generativelanguage.googleapis.com/v1beta/openai/</code>.
            </span>
          </div>

          <div className={styles.formRow}>
            <label className={styles.label} htmlFor="ai-model">
              Model
            </label>
            <input
              id="ai-model"
              className={styles.input}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="gpt-4.1-mini"
              required
              disabled={!canManage}
            />
            <span className={styles.hint}>
              Use the exact model name from your provider’s docs. A small, low-cost model is usually enough; a
              reasoning model may read damaged scans better.
            </span>
          </div>

          <div className={styles.formRow}>
            <label className={styles.label} htmlFor="ai-api-key">
              API key
            </label>
            <input
              id="ai-api-key"
              className={styles.input}
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={view.configured ? 'Leave blank to keep the stored key' : 'Paste the provider API key'}
              autoComplete="off"
              disabled={!canManage}
            />
            <span className={styles.hint}>
              Encrypted before storage and never shown again. Replacing it applies to the next extracted document.{' '}
              <a href="#provider-key">How to create a key</a>
            </span>
          </div>

          <div className={styles.formRow}>
            <label className={styles.hint} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={!canManage}
              />
              Use the AI model to extract fields for new documents
            </label>
            <span className={styles.hint}>
              Untick to keep the key stored but run the rules alone for now.
            </span>
          </div>

          <div className={styles.actions}>
            <Button type="submit" size="sm" disabled={!canManage || busy !== null || !view.encryptionAvailable}>
              {busy === 'save' ? 'Saving…' : 'Save settings'}
            </Button>
            {view.configured ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={remove}
                disabled={!canManage || busy !== null}
              >
                {busy === 'remove' ? 'Removing…' : 'Remove key'}
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>How it is used</span>
          <span className={styles.cardHint}>per workspace</span>
        </div>
        <div className={styles.cardBody}>
          <ul className={styles.hint} style={{ display: 'grid', gap: 8, paddingLeft: 16, margin: 0 }}>
            <li>The key is stored encrypted and returned only to the processing worker for this workspace&apos;s jobs.</li>
            <li>The model reads each document first and its readings are the values recorded; the rules only fill fields it leaves empty.</li>
            <li>Keys are not included in exports, audit entries or API responses; only the last four characters are shown.</li>
            <li>Removing the key immediately returns this workspace to rules-only extraction.</li>
            <li>Any provider with an OpenAI-compatible endpoint works — the model is whichever one you name here.</li>
          </ul>
        </div>
      </div>
      </div>
    </div>
  );
}
