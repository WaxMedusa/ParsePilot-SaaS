'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Writes `--p` (a plain number from 0 to 1) onto the track element while the
 * sticky child travels through the viewport. Values stay unitless so the CSS
 * that consumes them can do arithmetic.
 */
export function useScrollProgress(
  trackRef: RefObject<HTMLDivElement | null>,
  stickyRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const track = trackRef.current;
    const sticky = stickyRef.current;
    if (!track || !sticky) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      track.style.setProperty('--p', '1');
      return;
    }

    let frame = 0;
    let inView = false;

    const measure = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      // The stage pins below the sticky site header, so progress starts when
      // the track reaches that offset rather than the top of the viewport.
      const offset = parseFloat(window.getComputedStyle(sticky).top) || 0;
      const travel = rect.height - sticky.offsetHeight;
      const raw = travel <= 0 ? (rect.top <= offset ? 1 : 0) : (offset - rect.top) / travel;
      track.style.setProperty('--p', Math.min(1, Math.max(0, raw)).toFixed(4));
    };

    const schedule = () => {
      if (frame || !inView) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();

    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        if (inView) schedule();
      },
      { rootMargin: '20% 0px 20% 0px' },
    );
    observer.observe(track);

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [trackRef, stickyRef]);
}
