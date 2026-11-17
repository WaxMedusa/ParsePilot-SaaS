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

  return (
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
            <span className={styles.hint}>OpenAI-compatible base URL. HTTPS only.</span>
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
            <span className={styles.hint}>Small, low-cost models are usually enough; a reasoning model may read difficult documents better.</span>
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
              Encrypted before storage and never shown again. Replacing it applies to the next extracted document.
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
              Use the provider to review extractions for this workspace
            </label>
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
            <li>Rules still run first; the provider fills gaps and disagreements are sent to review instead of replacing rule values.</li>
            <li>Keys are not included in exports, audit entries or API responses; only the last four characters are shown.</li>
            <li>Removing the key immediately returns this workspace to rules-only extraction.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
