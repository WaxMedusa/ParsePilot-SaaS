'use client';

import { useState } from 'react';
import { UploadPanel } from './UploadPanel';
import styles from './Dashboard.module.css';

export function UploadDisclosure({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(true);

  return (
    <details
      open={open}
      className={styles.card}
      id="upload"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.cardHead} style={{ cursor: 'pointer', listStyle: 'none' }}>
        <span className={styles.cardTitle}>Add documents</span>
        <span className={styles.cardHint}>PDF · PNG · JPEG · TIFF · WebP</span>
      </summary>
      <div className={styles.cardBody}>
        <UploadPanel workspaceId={workspaceId} />
      </div>
    </details>
  );
}
