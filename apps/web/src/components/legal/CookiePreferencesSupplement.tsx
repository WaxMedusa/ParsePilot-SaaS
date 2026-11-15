import { CookiePreferencesPanel } from '@/components/cookies/CookiePreferencesPanel';
import styles from './LegalSupplement.module.css';

export function CookiePreferencesSupplement() {
  return (
    <section className={styles.supplement} aria-labelledby="cookie-preferences-heading">
      <div className="container">
        <div className={styles.inner}>
          <div className={styles.head}>
            <p className={styles.eyebrow}>Your choice</p>
            <h2 id="cookie-preferences-heading" className={styles.heading}>
              Cookie preferences
            </h2>
            <p className={styles.body}>
              These controls genuinely determine which categories are stored. Essential cookies keep you signed in and
              protect requests; optional categories are recorded but currently load no third-party scripts.
            </p>
          </div>
          <div className={styles.panel}>
            <CookiePreferencesPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
