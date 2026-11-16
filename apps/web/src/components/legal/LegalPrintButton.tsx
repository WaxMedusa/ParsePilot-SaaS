'use client';

import styles from './LegalLayout.module.css';

export function LegalPrintButton() {
  return (
    <button type="button" className={styles.printButton} onClick={() => window.print()}>
      Print / save as PDF
    </button>
  );
}
