'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './Onboarding.module.css';

const PROVIDERS = {
  google: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza… paste the key from AI Studio',
    href: 'https://aistudio.google.com/apikey',
    where: 'AI Studio → Create API key',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    keyPlaceholder: 'sk-… paste the secret key',
    href: 'https://platform.openai.com/api-keys',
    where: 'platform.openai.com/api-keys',
  },
} as const;

type ProviderId = keyof typeof PROVIDERS;

const STEPS = ['Name', 'AI extraction', 'Ready'];

type Props = {
  name: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  canManageAi: boolean;
  encryptionAvailable: boolean;
  aiConfigured: boolean;
};

export function OnboardingWizard({
  name,
  email,
  workspaceId,
  workspaceName,
  canManageAi,
  encryptionAvailable,
  aiConfigured,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(name);
  const [savedName, setSavedName] = useState(name);
  const [provider, setProvider] = useState<ProviderId>('google');
  const [model, setModel] = useState<string>(PROVIDERS.google.model);
  const [apiKey, setApiKey] = useState('');
  const [aiOn, setAiOn] = useState(aiConfigured);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstName = (savedName.trim().split(/\s+/)[0] || email.split('@')[0] || 'there').slice(0, 40);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Enter the name your team will see.');
      return;
    }
    setBusy('name');
    setError(null);
    try {
      await apiRequest('/api/v1/profile', { method: 'PATCH', body: { name: trimmed } });
      setSavedName(trimmed);
      setStep(1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const saveKey = async (event: React.FormEvent) => {
    event.preventDefault();
    const preset = PROVIDERS[provider];
    const key = apiKey.trim();
    if (key.length < 10) {
      setError('Paste the full key — it is always longer than this.');
      return;
    }
    setBusy('key');
    setError(null);
    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/ai-settings`, {
        method: 'PUT',
        workspaceId,
        body: { enabled: true, baseUrl: preset.baseUrl, model: model.trim() || preset.model, apiKey: key },
      });
      setAiOn(true);
      setApiKey('');
      setStep(2);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const skipKey = () => {
    setError(null);
    setStep(2);
  };

  const finish = async () => {
    setBusy('finish');
    setError(null);
    try {
      await apiRequest('/api/v1/onboarding/complete', { method: 'POST' });
      router.replace('/dashboard');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(null);
    }
  };

  return (
    <div className={styles.stack}>
      <ol className={styles.rail}>
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`${styles.railItem} ${index === step ? styles.railActive : ''} ${
              index < step ? styles.railDone : ''
            }`}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className={styles.railIndex}>{String(index + 1).padStart(2, '0')}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {error ? (
        <div className={`${styles.notice} ${styles.noticeDanger}`} role="alert">
          {error}
        </div>
      ) : null}

      {step === 0 ? (
        <form className={styles.card} onSubmit={saveName}>
          <p className={styles.eyebrow}>Welcome · {workspaceName}</p>
          <h1 className={styles.title}>What should we call you?</h1>
          <p className={styles.lede}>
            This is the name on documents you upload, review notes and exports — so your team knows who did what. Your
            Google name is already filled in; change it if you prefer.
          </p>

          <label className={styles.field}>
            <span className={styles.label}>Display name</span>
            <input
              className={styles.input}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              maxLength={80}
              autoComplete="name"
              autoFocus
            />
            <span className={styles.hint}>You can change this any time in Settings → Profile.</span>
          </label>

          <div className={styles.actions}>
            <Button type="submit" size="md" disabled={busy !== null}>
              {busy === 'name' ? 'Saving…' : 'Continue'}
            </Button>
            <span className={styles.actionsNote}>Takes about a minute.</span>
          </div>
        </form>
      ) : null}

      {step === 1 ? (
        <form className={styles.card} onSubmit={saveKey}>
          <p className={styles.eyebrow}>
            Step 02 · AI extraction <Badge tone="primary">Highly recommended</Badge>
          </p>
          <h1 className={styles.title}>Add a key to make extraction smarter.</h1>
          <p className={styles.lede}>
            Without a key, ParsePilot matches labels. With one, a model reads the whole page — remit-to blocks, PO
            numbers, item descriptions — and fills the fields the rules leave blank. Totals, dates and currencies are
            still validated by the same rules before anything reaches your review queue.
          </p>

          {!canManageAi ? (
            <div className={`${styles.notice} ${styles.noticeInfo}`} role="note">
              Only a workspace owner or admin can add the provider key. You can finish setup now and ask an
              administrator to add it under Settings → AI extraction.
            </div>
          ) : null}

          {canManageAi && !encryptionAvailable ? (
            <div className={`${styles.notice} ${styles.noticeWarning}`} role="note">
              Key storage is not configured on this deployment yet, so a key cannot be saved here. An administrator
              must set <code>SETTINGS_ENCRYPTION_KEY</code> first. You can still finish setup.
            </div>
          ) : null}

          {canManageAi && encryptionAvailable ? (
            <>
              <fieldset className={styles.fieldSet}>
                <legend className={styles.label}>Provider</legend>
                <div className={styles.providers}>
                  {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => (
                    <label
                      key={id}
                      className={`${styles.provider} ${provider === id ? styles.providerActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="provider"
                        value={id}
                        checked={provider === id}
                        onChange={() => {
                          setProvider(id);
                          setModel(PROVIDERS[id].model);
                        }}
                      />
                      <span className={styles.providerName}>{PROVIDERS[id].name}</span>
                      <span className={styles.providerHint}>{PROVIDERS[id].model}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={styles.field}>
                <span className={styles.label}>API key</span>
                <input
                  className={styles.input}
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={PROVIDERS[provider].keyPlaceholder}
                  autoComplete="off"
                />
                <span className={styles.hint}>
                  Get one at{' '}
                  <a href={PROVIDERS[provider].href} target="_blank" rel="noreferrer noopener">
                    {PROVIDERS[provider].where} ↗
                  </a>
                  . Encrypted at rest, used only for this workspace, never shown again.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Model</span>
                <input
                  className={styles.input}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={PROVIDERS[provider].model}
                />
                <span className={styles.hint}>A small, low-cost model is usually enough. The provider bills you directly.</span>
              </label>

              <div className={`${styles.notice} ${styles.noticeInfo}`} role="note">
                <div>
                  <strong>Why your own key.</strong> It belongs to your provider account, so document text travels
                  under your agreement with that provider rather than a shared ParsePilot account, and you can revoke
                  it there at any time. Step-by-step instructions, including Google Cloud Console, are in Settings → AI
                  extraction.
                </div>
              </div>
            </>
          ) : null}

          <div className={styles.actions}>
            {canManageAi && encryptionAvailable ? (
              <>
                <Button type="submit" size="md" disabled={busy !== null}>
                  {busy === 'key' ? 'Saving key…' : 'Save key and continue'}
                </Button>
                <Button type="button" variant="ghost" size="md" onClick={skipKey} disabled={busy !== null}>
                  Skip for now
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="md"
                onClick={skipKey}
                disabled={busy !== null}
              >
                Continue
              </Button>
            )}
            <button type="button" className={styles.textLink} onClick={() => setStep(0)} disabled={busy !== null}>
              ← Back
            </button>
          </div>
          {canManageAi && encryptionAvailable ? (
            <p className={styles.actionsNote}>
              Skipping is fine: the rules still run, and you can add a key later in Settings → AI extraction.
            </p>
          ) : null}
        </form>
      ) : null}

      {step === 2 ? (
        <div className={styles.card}>
          <p className={styles.eyebrow}>Step 03 · Ready</p>
          <h1 className={styles.title}>You&apos;re set up, {firstName}.</h1>
          <p className={styles.lede}>
            Upload an invoice, receipt, purchase order or statement and watch the pipeline run. Anything uncertain
            lands in your review queue rather than being guessed at.
          </p>

          <dl className={styles.summary}>
            <div className={styles.summaryRow}>
              <dt>Display name</dt>
              <dd>{savedName}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>AI extraction</dt>
              <dd>{aiOn ? 'On · model read plus rule validation' : 'Rules only'}</dd>
            </div>
          </dl>

          {!aiOn ? (
            <div className={`${styles.notice} ${styles.noticeWarning}`} role="note">
              <div>
                <strong>AI extraction is off.</strong> It is the single biggest reduction in fields your team has to
                correct, and it takes about two minutes to switch on in Settings → AI extraction — the same page has
                the Google Cloud Console steps.
              </div>
            </div>
          ) : null}

          <div className={styles.actions}>
            <Button type="button" size="md" onClick={finish} disabled={busy !== null}>
              {busy === 'finish' ? 'Opening…' : 'Open dashboard'}
            </Button>
            {!aiOn && canManageAi && encryptionAvailable ? (
              <Button type="button" variant="secondary" size="md" onClick={() => setStep(1)} disabled={busy !== null}>
                Add a key first
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
