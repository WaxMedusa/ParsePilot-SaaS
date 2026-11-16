'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './AuthForms.module.css';

export function InviteAcceptForm({ token, workspaceName }: { token: string; workspaceName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accept = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/invitations/accept', { method: 'POST', body: { token } });
      window.location.assign('/dashboard');
    } catch (caught) {
      setError(errorMessage(caught));
      setLoading(false);
    }
  };

  return (
    <div className={styles.form}>
      {error ? (
        <div className={styles.errorBox} role="alert">
          <span>{error}</span>
        </div>
      ) : null}
      <p className={styles.hint}>You will join {workspaceName} with the role shown above.</p>
      <button type="button" className={styles.submit} onClick={accept} disabled={loading}>
        {loading ? 'Joining…' : `Join ${workspaceName}`}
        {!loading ? <ArrowRight size={15} /> : null}
      </button>
    </div>
  );
}
