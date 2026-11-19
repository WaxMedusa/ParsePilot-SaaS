'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, HardDrive, ShieldAlert, X } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './ProfileSettings.module.css';

export type DriveStatusView = {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  folderName: string;
  encryptionAvailable: boolean;
  lastError: string | null;
  canConnect?: boolean;
};

type Props = {
  status: DriveStatusView | null;
  /** Set by the OAuth callback redirect. */
  driveState?: string | null;
};

export function StorageSettings({ status, driveState }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<{ authorizeUrl: string }>('/api/v1/integrations/google-drive', {
        method: 'POST',
      });
      window.location.assign(result.authorizeUrl);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/v1/integrations/google-drive', { method: 'DELETE' });
      setConfirming(false);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const canConnect =
    status?.canConnect ?? Boolean(status?.configured && status?.encryptionAvailable && !status?.connected);

  const banner =
    driveState === 'connected'
      ? 'Google Drive connected. New uploads are saved in your own Drive.'
      : driveState === 'denied'
        ? 'You cancelled the Google permission screen. Nothing changed.'
        : driveState === 'failed' || driveState === 'state' || driveState === 'invalid'
          ? 'Google Drive could not be connected. Try again.'
          : null;

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardKicker}>03 / Storage</p>
          <h2 className={styles.cardTitle}>Your own Google Drive</h2>
        </div>
        <span className={`${styles.pill} ${status?.connected ? styles.pillGood : styles.pillWarn}`}>
          {status?.connected ? 'Connected' : 'Optional'}
        </span>
      </div>

      <div className={styles.form}>
        {banner ? (
          <p className={driveState === 'connected' ? styles.saved : styles.error}>
            {driveState === 'connected' ? <Check size={12} /> : <X size={11} />} {banner}
          </p>
        ) : null}

        <p className={styles.avatarLead}>
          Upload your documents to a <code>{status?.folderName ?? 'ParsePilot'}</code> folder in your own Drive
          instead of ours. Files stay readable here, and the space they use is your Google quota, not the
          workspace&apos;s.
        </p>

        {status?.connected ? (
          <>
            <p className={styles.fieldHint}>
              Saving to <strong>{status.accountEmail ?? 'your Google account'}</strong>. Drive files you delete
              yourself cannot be opened here.
            </p>
            {status.lastError ? (
              <p className={styles.error}>
                <X size={11} /> Last Drive error: {status.lastError}
              </p>
            ) : null}
            <div className={styles.avatarActions}>
              {confirming ? (
                <>
                  <button type="button" className={styles.ghostDanger} onClick={disconnect} disabled={busy}>
                    {busy ? 'Moving files…' : 'Yes, disconnect'}
                  </button>
                  <button type="button" className={styles.secondary} onClick={() => setConfirming(false)} disabled={busy}>
                    Keep it
                  </button>
                </>
              ) : (
                <button type="button" className={styles.secondary} onClick={() => setConfirming(true)} disabled={busy}>
                  Disconnect
                </button>
              )}
            </div>
            {confirming ? (
              <p className={styles.fieldHint}>
                Disconnecting copies anything stored in Drive back into ParsePilot first, then revokes access.
              </p>
            ) : null}
          </>
        ) : canConnect ? (
          <div className={styles.avatarActions}>
            <button type="button" className={styles.primary} onClick={connect} disabled={busy}>
              <HardDrive size={13} /> {busy ? 'Opening Google…' : 'Connect Google Drive'}
            </button>
          </div>
        ) : (
          <p className={styles.fieldHint}>
            <ShieldAlert size={11} />{' '}
            {status
              ? 'Not available on this deployment yet — an administrator needs to add the Google OAuth client ID and secret.'
              : 'Status unavailable.'}
          </p>
        )}

        {error ? (
          <p className={styles.error}>
            <X size={11} /> {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
