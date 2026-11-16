'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './TeamPanel.module.css';

type Role = 'owner' | 'admin' | 'member' | 'viewer';
type InvitableRole = 'admin' | 'member' | 'viewer';

type Member = {
  id: string;
  role: Role;
  createdAt: string;
  userId: string;
  email: string;
  name: string | null;
  lastLoginAt: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
  invitedBy: { name: string | null; email: string };
};

type Props = {
  workspaceId: string;
  workspaceName: string;
  currentUserId: string;
  role: Role;
  planCode: string;
  maxMembers: number;
  members: Member[];
  invitations: Invitation[];
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function roleOptions(role: Role): InvitableRole[] {
  if (role === 'owner') return ['admin', 'member', 'viewer'];
  if (role === 'admin') return ['member', 'viewer'];
  return [];
}

function canManage(role: Role, member: Member, currentUserId: string): boolean {
  if (member.userId === currentUserId || member.role === 'owner') return false;
  if (role === 'owner') return true;
  if (role === 'admin') return member.role === 'member' || member.role === 'viewer';
  return false;
}

export function TeamPanel({
  workspaceId,
  workspaceName,
  currentUserId,
  role,
  planCode,
  maxMembers,
  members,
  invitations,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitableRole>('member');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const options = roleOptions(role);
  const canInvite = options.includes(inviteRole);
  const seatsUsed = members.length + invitations.length;
  const full = seatsUsed >= maxMembers;

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canInvite) return;
    setBusy('invite');
    setError(null);
    setNotice(null);
    setInviteUrl(null);
    setCopied(false);
    try {
      const result = await apiRequest<{
        inviteUrl: string;
        emailSent: boolean;
        invitation: { email: string };
      }>(`/api/v1/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: { email, role: inviteRole },
      });
      setInviteUrl(result.inviteUrl);
      setNotice(
        result.emailSent
          ? `Invitation email sent to ${result.invitation.email}. You can also copy the link below.`
          : 'Invitation created, but transactional email is not configured. Copy the link below and send it directly.',
      );
      setEmail('');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (invitationId: string) => {
    setBusy(`revoke:${invitationId}`);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`, { method: 'DELETE' });
      setNotice('Invitation revoked.');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (member: Member, nextRole: InvitableRole) => {
    setBusy(`role:${member.id}`);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/members/${member.id}`, {
        method: 'PATCH',
        body: { role: nextRole },
      });
      setNotice(`${member.email} is now a ${nextRole}.`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (member: Member) => {
    if (!window.confirm(`Remove ${member.email} from ${workspaceName}?`)) return;
    setBusy(`remove:${member.id}`);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/members/${member.id}`, { method: 'DELETE' });
      setNotice(`${member.email} was removed from the workspace.`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <div>
          <span className={styles.summaryLabel}>Workspace</span>
          <span className={styles.summaryValue}>{workspaceName}</span>
        </div>
        <div>
          <span className={styles.summaryLabel}>Plan</span>
          <span className={styles.summaryValue}>{planCode}</span>
        </div>
        <div>
          <span className={styles.summaryLabel}>Seats</span>
          <span className={styles.summaryValue}>
            {seatsUsed} / {maxMembers}
          </span>
        </div>
        <div>
          <span className={styles.summaryLabel}>Your role</span>
          <span className={styles.summaryValue}>{role}</span>
        </div>
      </div>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      {inviteUrl ? (
        <div className={styles.inviteLink}>
          <label htmlFor="invite-link">Invitation link</label>
          <div className={styles.inviteLinkRow}>
            <input id="invite-link" readOnly value={inviteUrl} onFocus={(event) => event.target.select()} />
            <button type="button" onClick={copyInvite}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <p>Only the invited email address can use this link. It expires automatically.</p>
        </div>
      ) : null}

      <section className={styles.section} aria-labelledby="invite-title">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.kicker}>Invite</p>
            <h2 id="invite-title">Add a teammate</h2>
          </div>
          <span className={styles.sectionMeta}>{full ? 'No seats remaining' : `${maxMembers - seatsUsed} seat${maxMembers - seatsUsed === 1 ? '' : 's'} available`}</span>
        </div>

        {canInvite ? (
          <form className={styles.form} onSubmit={invite}>
            <label>
              <span>Work email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
              />
            </label>
            <label>
              <span>Role</span>
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as InvitableRole)}>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy !== null || full}>
              {busy === 'invite' ? 'Sending…' : 'Send invitation'}
            </button>
          </form>
        ) : (
          <p className={styles.helper}>Only workspace owners and admins can invite teammates.</p>
        )}
        {full ? (
          <p className={styles.helper}>
            Your plan includes {maxMembers} seats. Revoke a pending invitation or upgrade the plan to invite another
            person.
          </p>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="members-title">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.kicker}>Members</p>
            <h2 id="members-title">Who has access</h2>
          </div>
          <span className={styles.sectionMeta}>{members.length} active</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last seen</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const editable = canManage(role, member, currentUserId);
                return (
                  <tr key={member.id}>
                    <td data-label="Person">
                      <span className={styles.memberName}>{member.name ?? 'Unnamed member'}</span>
                      <span className={styles.memberEmail}>{member.email}</span>
                      {member.userId === currentUserId ? <span className={styles.you}>You</span> : null}
                    </td>
                    <td data-label="Role">
                      {editable ? (
                        <select
                          className={styles.roleSelect}
                          value={member.role}
                          disabled={busy !== null}
                          aria-label={`Role for ${member.email}`}
                          onChange={(event) => changeRole(member, event.target.value as InvitableRole)}
                        >
                          {member.role === 'owner' ? <option value="owner">owner</option> : null}
                          {roleOptions(role).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={styles.role}>{member.role}</span>
                      )}
                    </td>
                    <td data-label="Joined" className={styles.date}>{formatDate(member.createdAt)}</td>
                    <td data-label="Last seen" className={styles.date}>{formatDate(member.lastLoginAt)}</td>
                    <td className={styles.actions}>
                      {editable ? (
                        <button type="button" onClick={() => remove(member)} disabled={busy !== null}>
                          {busy === `remove:${member.id}` ? 'Removing…' : 'Remove'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="pending-title">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.kicker}>Pending</p>
            <h2 id="pending-title">Invitations</h2>
          </div>
          <span className={styles.sectionMeta}>{invitations.length} awaiting response</span>
        </div>
        {invitations.length === 0 ? (
          <p className={styles.helper}>No pending invitations.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Invited by</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td data-label="Email">{invitation.email}</td>
                    <td data-label="Role" className={styles.role}>{invitation.role}</td>
                    <td data-label="Invited by" className={styles.date}>
                      {invitation.invitedBy.name ?? invitation.invitedBy.email}
                    </td>
                    <td data-label="Expires" className={styles.date}>{formatDate(invitation.expiresAt)}</td>
                    <td className={styles.actions}>
                      {role === 'owner' || role === 'admin' ? (
                        <button type="button" onClick={() => revoke(invitation.id)} disabled={busy !== null}>
                          {busy === `revoke:${invitation.id}` ? 'Revoking…' : 'Revoke'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.footnote}>
        Invitations are tied to the email address they are sent to. Roles control access to documents, edits, review
        approvals and workspace settings.
      </p>
    </div>
  );
}
