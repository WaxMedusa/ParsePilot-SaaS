'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useScrollProgress } from './useScrollProgress';
import styles from './ScrollScene.module.css';

type ScrollSceneProps = {
  children: ReactNode;
  /** Total scroll travel for the scene. The sticky stage is one viewport tall. */
  height?: string;
  className?: string;
};

/**
 * Pins its children for the length of the track and publishes scroll progress
 * as `--p` (0 → 1). Children style themselves from that value in CSS, so no
 * React render happens per frame.
 */
export function ScrollScene({ children, height = '280vh', className }: ScrollSceneProps) {
  const track = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);

  useScrollProgress(track, sticky);

  return (
    <div
      ref={track}
      className={styles.track}
      style={{ ['--scene-height' as string]: height } as CSSProperties}
    >
      <div ref={sticky} className={styles.sticky}>
        <div className={className ? `${styles.inner} ${className}` : styles.inner}>{children}</div>
      </div>
    </div>
  );
}
