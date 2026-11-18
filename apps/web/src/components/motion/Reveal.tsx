'use client';

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import styles from './Reveal.module.css';

let gateOpen = false;

/**
 * Content is visible by default. The hidden state is only applied once this
 * component mounts, so nothing depends on JavaScript to be readable.
 */
function openMotionGate() {
  if (gateOpen || typeof document === 'undefined') return;
  gateOpen = true;
  document.documentElement.dataset.motion = 'ready';
}

/** Elements that can carry the reveal without adding a wrapping box, which
 *  matters for children of a grid. */
type RevealTag =
  | 'div'
  | 'section'
  | 'article'
  | 'header'
  | 'footer'
  | 'aside'
  | 'figure'
  | 'li'
  | 'p'
  | 'h2'
  | 'h3';

type RevealProps = {
  children: ReactNode;
  /** Milliseconds of stagger, applied through a custom property. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: RevealTag;
};

export function Reveal({ children, delay = 0, className, style, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    openMotionGate();

    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      node.dataset.revealed = 'true';
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealed = 'true';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Component = as as ElementType;

  return (
    <Component
      ref={ref}
      className={className ? `${styles.reveal} ${className}` : styles.reveal}
      style={{ ...style, ['--reveal-delay' as string]: `${delay}ms` } as CSSProperties}
    >
      {children}
    </Component>
  );
}
