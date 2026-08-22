'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Client-side motion primitives.
 *
 * These are deliberately leaf components: the pages that use them stay Server
 * Components, and only the interactive shell ships to the browser. Marking a
 * page 'use client' to get a hover effect would send the whole tree.
 *
 * None of them hold React state. Each renders its *final* markup on the
 * server -- the real number, the visible content -- and then animates the DOM
 * node directly through a ref. That keeps the server output correct for
 * crawlers, screenshots and no-JS readers, and keeps a 60fps animation from
 * queueing a React render on every frame.
 *
 * Every component checks prefers-reduced-motion and simply leaves the final
 * state in place when it is set.
 */

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* --------------------------------------------------------------------------
   Spotlight -- the card lights up under the cursor.

   Writes --az-spot-x/y on the element; the gradient itself lives in
   globals.css (.az-spotlight::before) so the paint stays on the compositor.
   -------------------------------------------------------------------------- */

export function Spotlight({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    // Coarse pointers have no hover; skip the listener entirely on touch.
    if (!window.matchMedia('(hover: hover)').matches) return;

    let frame = 0;
    function onMove(event: MouseEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        node.style.setProperty('--az-spot-x', `${event.clientX - rect.left}px`);
        node.style.setProperty('--az-spot-y', `${event.clientY - rect.top}px`);
      });
    }

    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mousemove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={`az-spotlight ${className}`} style={style}>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------------
   CountUp -- numbers roll to their value instead of snapping.

   The server renders the final number. The effect rewinds it to zero and
   plays it forward only when motion is allowed, so the pre-hydration paint
   and the reduced-motion path both show the true value.
   -------------------------------------------------------------------------- */

export function CountUp({
  value,
  duration = 900,
  suffix = '',
  className = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || played.current) return;
    played.current = true;
    if (prefersReducedMotion() || value === 0) return;

    let frame = 0;
    const start = performance.now();

    function tick(now: number) {
      const node = ref.current;
      if (!node) return;
      const t = Math.min((now - start) / duration, 1);
      // easeOutExpo -- fast arrival, gentle settle
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      node.textContent = Math.round(value * eased).toLocaleString() + suffix;
      if (t < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, suffix]);

  return (
    <span ref={ref} className={`az-tabular ${className}`}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Reveal -- content rises as it scrolls into view.

   IntersectionObserver rather than a scroll handler, and it unobserves after
   firing so a long page does not keep N observers alive.
   -------------------------------------------------------------------------- */

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('az-revealed');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('az-revealed');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`az-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
