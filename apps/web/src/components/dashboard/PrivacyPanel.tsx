'use client';

import { useState } from 'react';
import { AlertTriangle, Download, KeyRound, Monitor, ShieldCheck, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiRequest, errorMessage } from '@/lib/client/api';
import { formatDateTime } from '@/lib/format';
import styles from './Dashboard.module.css';
import panel from './PrivacyPanel.module.css';

export type PrivacyAccount = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  deletionRequestedAt: string | null;
};

export type PrivacySession = {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
};

export type PrivacyRequest = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
  resultExpiresAt: string | null;
};

type Props = {
  account: PrivacyAccount;
  sessions: PrivacySession[];
  requests: PrivacyRequest[];
  workspaces: { id: string; name: string; role: string }[];
  retention: { softDeletedDocumentPurgeDays: number; exportExpiryDays: number; sessionAbsoluteDays: number; auditLogMonths: number; backupRetentionDays: number };
  workspaceId: string;
  role: string;
};

const REQUEST_LABEL: Record<string, string> = {
  account_export: 'Account data export',
  workspace_deletion: 'Workspace deletion',
  account_deletion: 'Account deletion',
  document_export: 'Document export',
};

export function PrivacyPanel({ account, sessions, requests, workspaces, retention, workspaceId, role }: Props) {
  const [requestList, setRequestList] = useState(requests);
  const [sessionList, setSessionList] = useState(sessions);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [accountConfirm, setAccountConfirm] = useState('');
  const [deleteWorkspaces, setDeleteWorkspaces] = useState(false);
  const [workspaceConfirm, setWorkspaceConfirm] = useState('');

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const refreshRequests = async () => {
    const rows = await apiRequest<PrivacyRequest[]>('/api/v1/privacy/requests');
    setRequestList(rows);
  };

  const requestExport = () =>
    run('export', async () => {
      await apiRequest('/api/v1/privacy/requests', { method: 'POST', workspaceId, body: { type: 'workspace_export' } });
      await refreshRequests();
      setNotice('Export requested. A background job is preparing a private JSON bundle; refresh in a moment.');
    });

  const downloadExport = (request: PrivacyRequest) =>
    run(`download-${request.id}`, async () => {
      const result = await apiRequest<{ url: string }>(`/api/v1/privacy/requests/${request.id}/download`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    });

  const revokeSession = (session: PrivacySession) =>
    run(`session-${session.id}`, async () => {
      await apiRequest(`/api/v1/privacy/sessions/${session.id}`, { method: 'DELETE' });
      setSessionList((current) => current.filter((entry) => entry.id !== session.id));
      setNotice('Session revoked.');
    });

  const cancelAccountDeletion = () =>
    run('cancel-deletion', async () => {
      await apiRequest('/api/v1/privacy/account-deletion/cancel', { method: 'POST' });
      setNotice('Account deletion request cancelled.');
    });

  const requestAccountDeletion = () =>
    run('delete-account', async () => {
      await apiRequest('/api/v1/privacy/account-deletion', {
        method: 'POST',
        body: { password, confirmation: accountConfirm, deleteWorkspaces },
      });
      setNotice('Account deletion scheduled. You have been signed out. Deletion runs after the grace period.');
      setPassword('');
      setAccountConfirm('');
      window.setTimeout(() => window.location.assign('/'), 2500);
    });

  const requestWorkspaceDeletion = () =>
    run('delete-workspace', async () => {
      await apiRequest('/api/v1/privacy/workspace-deletion', {
        method: 'POST',
        workspaceId,
        body: { confirmation: workspaceConfirm },
      });
      setNotice('Workspace deletion scheduled. Documents and storage objects will be purged after the grace period.');
      setWorkspaceConfirm('');
    });

  const isOwner = role === 'owner';
  const deletionPending = Boolean(account.deletionRequestedAt) || requestList.some((entry) => entry.type === 'account_deletion' && ['pending', 'processing'].includes(entry.status));

  return (
    <div className={styles.page}>
      {error ? <div className={`${styles.notice} ${styles.noticeDanger}`} role="alert">{error}</div> : null}
      {notice ? <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status">{notice}</div> : null}

      <div className={styles.split}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Account information</span>
            <span className={styles.cardHint}>controller data</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.kv}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Email</span>
                <span className={styles.kvValue}>{account.email}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Name</span>
                <span className={styles.kvValue}>{account.name ?? '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Account created</span>
                <span className={`${styles.kvValue} ${styles.kvMono}`}>{formatDateTime(account.createdAt)}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Last sign-in</span>
                <span className={`${styles.kvValue} ${styles.kvMono}`}>{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Workspace role</span>
                <span className={styles.kvValue}>{role}</span>
              </div>
            </div>
          </div>
          <div className={styles.cardFoot}>
            <span>Workspaces: {workspaces.map((workspace) => `${workspace.name} (${workspace.role})`).join(', ') || '—'}</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Retention</span>
            <span className={styles.cardHint}>configured</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.kv}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Deleted document purge</span>
                <span className={styles.kvValue}>{retention.softDeletedDocumentPurgeDays} days</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Export expiry</span>
                <span className={styles.kvValue}>{retention.exportExpiryDays} days</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Session lifetime</span>
                <span className={styles.kvValue}>{retention.sessionAbsoluteDays} days</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Audit log retention</span>
                <span className={styles.kvValue}>{retention.auditLogMonths} months</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Backup rotation</span>
                <span className={styles.kvValue}>{retention.backupRetentionDays} days</span>
              </div>
            </div>
            <p className={styles.hint} style={{ marginTop: 10 }}>
              Billing records may be kept longer where law requires. Backups may retain deleted data until rotation
              completes.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Your data</span>
          <span className={styles.cardHint}>
            <ShieldCheck size={11} /> export or delete
          </span>
        </div>
        <div className={styles.cardBody}>
          <p className={styles.sectionBody}>
            Request a machine-readable copy of your account and workspace data — including document metadata and
            extracted field values, but not the document files themselves. Download each document separately before
            deleting your account.
          </p>
          <div className={styles.actions} style={{ marginTop: 12 }}>
            <Button variant="secondary" size="sm" icon={<Download />} onClick={requestExport} disabled={busy !== null}>
              {busy === 'export' ? 'Requesting…' : 'Request workspace data export'}
            </Button>
            <span className={styles.hint}>Prepared asynchronously · expires after {retention.exportExpiryDays} days</span>
          </div>

          {requestList.length > 0 ? (
            <div className={panel.requests}>
              {requestList.map((request) => (
                <div key={request.id} className={panel.requestRow}>
                  <div className={panel.requestMain}>
                    <span className={panel.requestType}>{REQUEST_LABEL[request.type] ?? request.type}</span>
                    <span className={panel.requestMeta}>
                      Requested {formatDateTime(request.createdAt)}
                      {request.failureReason ? ` · ${request.failureReason}` : ''}
                    </span>
                  </div>
                  <StatusBadge status={request.status} />
                  {request.status === 'completed' && request.type !== 'account_deletion' && request.type !== 'workspace_deletion' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Download />}
                      onClick={() => downloadExport(request)}
                      disabled={busy !== null}
                    >
                      Download
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Active sessions</span>
          <span className={styles.cardHint}>revocable per device</span>
        </div>
        <div className={styles.cardBody}>
          <ul className={panel.sessions}>
            {sessionList.map((session) => (
              <li key={session.id} className={panel.session}>
                <span className={panel.sessionIcon}>
                  <Monitor size={13} />
                </span>
                <div className={panel.sessionMain}>
                  <span className={panel.sessionAgent}>{session.userAgent ?? 'Unknown browser'}</span>
                  <span className={panel.sessionMeta}>
                    Signed in {formatDateTime(session.createdAt)} · last used {formatDateTime(session.lastUsedAt)}
                  </span>
                </div>
                {session.current ? (
                  <span className={panel.current}>This device</span>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => revokeSession(session)} disabled={busy !== null}>
                    {busy === `session-${session.id}` ? 'Revoking…' : 'Revoke'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className={styles.hint} style={{ marginTop: 10 }}>
            <KeyRound size={10} /> Session tokens are stored only as hashes. Signing out or resetting your password revokes
            them.
          </p>
        </div>
      </div>

      <section className={`${styles.card} ${panel.dangerCard}`}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>
            <AlertTriangle size={13} /> Destructive actions
          </span>
          <span className={styles.cardHint}>reauthentication required</span>
        </div>
        <div className={styles.cardBody}>
          <p className={styles.sectionBody}>
            These actions are scheduled and executed by a background job after a documented grace period. Deleting a
            workspace removes its documents, extraction records and storage objects. Billing records required by law may
            be retained, and backups may hold copies until rotation.
          </p>

          {deletionPending ? (
            <div className={`${styles.notice} ${styles.noticeWarning}`} style={{ marginTop: 14 }}>
              <div>
                <strong>Account deletion is pending.</strong>
                <p style={{ marginTop: 4 }}>
                  Your sessions were signed out. You can cancel the request before the grace period ends.
                </p>
                <div className={styles.actions} style={{ marginTop: 10 }}>
                  <Button variant="secondary" size="sm" onClick={cancelAccountDeletion} disabled={busy !== null}>
                    {busy === 'cancel-deletion' ? 'Cancelling…' : 'Cancel account deletion'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {isOwner ? (
            <details className={panel.details}>
              <summary className={panel.summary}>
                <Trash2 size={13} /> Delete this workspace
              </summary>
              <div className={panel.detailsBody}>
                <p className={styles.sectionBody}>
                  This schedules deletion of the entire workspace and requires you to type{' '}
                  <code className={panel.code}>DELETE WORKSPACE</code>.
                </p>
                <div className={styles.formRow} style={{ marginTop: 10 }}>
                  <label className={styles.label} htmlFor="workspace-confirm">
                    Confirmation
                  </label>
                  <input
                    id="workspace-confirm"
                    className={styles.input}
                    value={workspaceConfirm}
                    onChange={(event) => setWorkspaceConfirm(event.target.value)}
                    placeholder="DELETE WORKSPACE"
                  />
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={requestWorkspaceDeletion}
                  disabled={busy !== null || workspaceConfirm.trim().toUpperCase() !== 'DELETE WORKSPACE'}
                >
                  {busy === 'delete-workspace' ? 'Scheduling…' : 'Schedule workspace deletion'}
                </Button>
              </div>
            </details>
          ) : null}

          <details className={panel.details}>
            <summary className={panel.summary}>
              <Trash2 size={13} /> Delete my account
            </summary>
            <div className={panel.detailsBody}>
              <p className={styles.sectionBody}>
                Deletion is scheduled after a grace period. Workspaces you solely own are deleted with the account. If a
                workspace still has other members, deletion is blocked until ownership is transferred. Type{' '}
                <code className={panel.code}>DELETE</code> and confirm your password.
              </p>
              <div className={styles.formRow} style={{ marginTop: 10 }}>
                <label className={styles.label} htmlFor="account-password">
                  Password
                </label>
                <input
                  id="account-password"
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label} htmlFor="account-confirm">
                  Type DELETE to confirm
                </label>
                <input
                  id="account-confirm"
                  className={styles.input}
                  value={accountConfirm}
                  onChange={(event) => setAccountConfirm(event.target.value)}
                  placeholder="DELETE"
                />
              </div>
              <label className={panel.checkboxRow}>
                <input type="checkbox" checked={deleteWorkspaces} onChange={(event) => setDeleteWorkspaces(event.target.checked)} />
                <span>I understand that workspaces I solely own will be deleted with my account.</span>
              </label>
              <Button
                variant="danger"
                size="sm"
                onClick={requestAccountDeletion}
                disabled={busy !== null || accountConfirm.trim().toUpperCase() !== 'DELETE' || !password || !deleteWorkspaces}
              >
                {busy === 'delete-account' ? 'Scheduling…' : 'Schedule account deletion'}
              </Button>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
