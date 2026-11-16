import { describe, expect, it } from 'vitest';
import { emailVerificationEmail, passwordResetEmail, workspaceInvitationEmail } from './templates';

describe('transactional email templates', () => {
  it('includes the reset link and expiry in text and HTML', () => {
    const message = passwordResetEmail({
      name: 'Ada',
      resetUrl: 'https://app.example/reset-password?token=abc',
      expiresMinutes: 60,
    });
    expect(message.subject).toBe('Reset your ParsePilot password');
    expect(message.text).toContain('https://app.example/reset-password?token=abc');
    expect(message.text).toContain('60 minutes');
    expect(message.html).toContain('Set a new password');
  });

  it('escapes user-controlled HTML in the invitation email', () => {
    const message = workspaceInvitationEmail({
      workspaceName: '<script>alert(1)</script>',
      inviterName: 'Mallory <mallory@example.com>',
      inviteeEmail: 'new@example.com',
      role: 'member',
      inviteUrl: 'https://app.example/invite/token?a=1&b=2',
      expiresDays: 7,
    });
    expect(message.html).not.toContain('<script>alert(1)</script>');
    expect(message.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(message.html).toContain('Mallory &lt;mallory@example.com&gt;');
    expect(message.html).toContain('https://app.example/invite/token?a=1&amp;b=2');
    expect(message.text).toContain('new@example.com');
  });

  it('describes email verification as expiring in hours', () => {
    const message = emailVerificationEmail({
      name: null,
      verifyUrl: 'https://app.example/verify-email?token=abc',
      expiresMinutes: 1440,
    });
    expect(message.subject).toBe('Verify your ParsePilot email');
    expect(message.text).toContain('Hello there');
    expect(message.text).toContain('24 hours');
    expect(message.html).toContain('Verify email address');
  });
});
