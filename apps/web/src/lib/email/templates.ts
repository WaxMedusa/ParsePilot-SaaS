function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayName(name: string | null | undefined): string {
  return name?.trim() || 'there';
}

function layout(input: { title: string; body: string; footer?: string }): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f1eb;color:#171816;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1eb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dcdcd5;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #dcdcd5;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">
                ParsePilot / account
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <h1 style="margin:0 0 20px;font-size:28px;line-height:1.12;font-weight:600;letter-spacing:-.03em;">${escapeHtml(input.title)}</h1>
                <div style="font-size:15px;line-height:1.65;color:#3f403b;">${input.body}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #dcdcd5;font-size:11px;line-height:1.6;color:#777873;">
                ${input.footer ?? 'This is a transactional message from ParsePilot.'}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#171816;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export function passwordResetEmail(input: { name: string | null; resetUrl: string; expiresMinutes: number }) {
  const subject = 'Reset your ParsePilot password';
  const text = `Hello ${displayName(input.name)},

A password reset was requested for your ParsePilot account.

Open this link to choose a new password:
${input.resetUrl}

The link expires in ${input.expiresMinutes} minutes and can only be used once. If you did not request this, you can ignore this email; your password has not changed.

ParsePilot`;
  const html = layout({
    title: 'Reset your password',
    body: `<p style="margin:0 0 14px;">Hello ${escapeHtml(displayName(input.name))},</p>
      <p style="margin:0;">A password reset was requested for your ParsePilot account. Choose a new password using the link below.</p>
      ${button(input.resetUrl, 'Set a new password')}
      <p style="margin:0;font-size:12px;color:#777873;">This link expires in ${input.expiresMinutes} minutes and can only be used once. If you did not request it, you can ignore this email; your password has not changed.</p>`,
  });
  return { subject, text, html };
}

export function emailVerificationEmail(input: { name: string | null; verifyUrl: string; expiresMinutes: number }) {
  const hours = Math.max(1, Math.round(input.expiresMinutes / 60));
  const subject = 'Verify your ParsePilot email';
  const text = `Hello ${displayName(input.name)},

Confirm the email address on your ParsePilot account:
${input.verifyUrl}

The link expires in ${hours} hour${hours === 1 ? '' : 's'} and can only be used once.

If you did not create this account, you can ignore this email.

ParsePilot`;
  const html = layout({
    title: 'Verify your email',
    body: `<p style="margin:0 0 14px;">Hello ${escapeHtml(displayName(input.name))},</p>
      <p style="margin:0;">Confirm the email address on your ParsePilot account using the link below.</p>
      ${button(input.verifyUrl, 'Verify email address')}
      <p style="margin:0;font-size:12px;color:#777873;">This link expires in ${hours} hour${hours === 1 ? '' : 's'} and can only be used once. If you did not create this account, you can ignore this email.</p>`,
  });
  return { subject, text, html };
}

export function workspaceInvitationEmail(input: {
  workspaceName: string;
  inviterName: string | null;
  inviteeEmail: string;
  role: string;
  inviteUrl: string;
  expiresDays: number;
}) {
  const inviter = input.inviterName?.trim() || 'A workspace owner';
  const subject = `${inviter} invited you to ${input.workspaceName} on ParsePilot`;
  const text = `${inviter} invited you to join the ${input.workspaceName} workspace on ParsePilot as a ${input.role}.

Accept the invitation:
${input.inviteUrl}

This link expires in ${input.expiresDays} day${input.expiresDays === 1 ? '' : 's'}. Sign in with ${input.inviteeEmail} or create an account using that address to accept.

If you were not expecting this invitation, you can ignore this email.

ParsePilot`;
  const html = layout({
    title: `Join ${input.workspaceName}`,
    body: `<p style="margin:0 0 14px;">${escapeHtml(inviter)} invited you to join <strong>${escapeHtml(input.workspaceName)}</strong> on ParsePilot as a <strong>${escapeHtml(input.role)}</strong>.</p>
      ${button(input.inviteUrl, 'Accept invitation')}
      <p style="margin:0;font-size:12px;color:#777873;">This link expires in ${input.expiresDays} day${input.expiresDays === 1 ? '' : 's'}. Sign in with ${escapeHtml(input.inviteeEmail)} or create an account using that address to accept. If you were not expecting this invitation, you can ignore this email.</p>`,
    footer: 'You received this because a workspace administrator invited this email address.',
  });
  return { subject, text, html };
}
