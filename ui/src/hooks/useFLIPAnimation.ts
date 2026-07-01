// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { THEME_ANIMATIONS } from '../constants/theme';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Id-keyed FLIP for the equation tree (#234). Nodes carry a stable `data-flip-id`
 * (the math-engine node id, which survives a transform — see `ensureNodeIds`), so
 * a term that moves keeps its id and we can slide it from its old box to its new
 * one.
 *
 * Why the work is deferred into a `requestAnimationFrame` rather than done inline
 * in the layout effect: an equation change fans out into *several* synchronous
 * React commits (the transform itself, then `useMathScale` settling the scale),
 * and those commits **remount** the node subtree — the DOM elements present when
 * the layout effect runs are detached before the next paint. Capturing them there
 * and mutating their style is throwing darts at orphans (the bug this fixes: the
 * invert landed on disconnected nodes, so the live ones snapped). Instead we wait
 * one frame for the commits to settle, re-query the *live* nodes by id, INVERT
 * them (still before the first paint of the new layout, so no flicker), force a
 * reflow to commit that "from" geometry, then PLAY — all in the one frame, so a
 * stray later commit can't orphan a half-applied animation. Keeping INVERT and
 * PLAY in the same frame (with a reflow between) is also what makes the
 * transition actually fire: starting a transition from `transition: none` across
 * a frame boundary is silently dropped by browsers.
 */
export function useFLIPAnimation(
  containerRef: React.RefObject<HTMLDivElement | null>,
  dependency: unknown,
  reducedMotion: boolean = false,
  // Reports when a slide is in flight, so consumers can suppress chrome that
  // would jitter mid-animation — e.g. node tooltips popping up under the cursor
  // while the term is still moving (#234).
  onAnimatingChange?: (animating: boolean) => void
) {
  const boundingBoxRef = useRef<Map<string, DOMRect>>(new Map());
  const animatingTimeoutRef = useRef(0);

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // `firstRects` are plain geometry from the previous settled layout, so they
    // survive the remount that orphans the actual elements.
    const firstRects = boundingBoxRef.current;

    const measureRaf = requestAnimationFrame(() => {
      // All synchronous commits for this change have settled; these are the
      // elements that will actually be painted.
      const elements = Array.from(container.querySelectorAll('[data-flip-id]')) as HTMLElement[];
      const lastRects = new Map<string, DOMRect>();
      elements.forEach((el) => {
        const id = el.getAttribute('data-flip-id');
        if (id) lastRects.set(id, el.getBoundingClientRect());
      });
      // Record settled positions for the next change before any transform is
      // applied (getBoundingClientRect includes transforms, so order matters).
      boundingBoxRef.current = lastRects;

      // Respect `prefers-reduced-motion` (#234, paired with #145): track
      // positions but never animate, so flipping the OS setting back off can't
      // play a stale, long-since-settled delta.
      if (reducedMotion) return;

      // Translations we apply per id, used to subtract an ancestor's movement
      // from a descendant's so nested transforms don't compound.
      const appliedTranslations = new Map<string, { dx: number; dy: number }>();
      const toPlay: HTMLElement[] = [];

      // Document order is preorder, so an ancestor is always processed before
      // its descendants and its translation is available below.
      elements.forEach((el) => {
        const id = el.getAttribute('data-flip-id');
        if (!id) return;

        const firstRect = firstRects.get(id);
        const lastRect = lastRects.get(id);
        if (!firstRect || !lastRect) return;

        const viewportDx = firstRect.left - lastRect.left;
        const viewportDy = firstRect.top - lastRect.top;
        if (viewportDx === 0 && viewportDy === 0) return;

        let nearestAncestorId: string | null = null;
        let ancestor: HTMLElement | null = el.parentElement;
        while (ancestor && ancestor !== container) {
          const ancestorId = ancestor.getAttribute('data-flip-id');
          if (ancestorId && firstRects.has(ancestorId)) {
            nearestAncestorId = ancestorId;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        let dx = viewportDx;
        let dy = viewportDy;
        if (nearestAncestorId) {
          const ancestorTrans = appliedTranslations.get(nearestAncestorId);
          if (ancestorTrans) {
            dx -= ancestorTrans.dx;
            dy -= ancestorTrans.dy;
          }
        }

        // Record the full viewport delta (what a descendant must subtract).
        appliedTranslations.set(id, { dx: viewportDx, dy: viewportDy });

        if (dx !== 0 || dy !== 0) {
          // INVERT: snap the live element back to its old position.
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.transition = 'none';
          toPlay.push(el);
        }
      });

      if (toPlay.length === 0) return;

      // Flag the slide as in flight and schedule the all-clear a beat after the
      // transition would finish. A new slide resets this window; we deliberately
      // don't clear it on plain dep changes, so it always resolves to "settled".
      onAnimatingChange?.(true);
      window.clearTimeout(animatingTimeoutRef.current);
      animatingTimeoutRef.current = window.setTimeout(() => {
        onAnimatingChange?.(false);
      }, THEME_ANIMATIONS.TRANSITION_DURATION_MS + 50);

      // Force a reflow so the inverted positions are committed as the
      // transition's "from" geometry, then PLAY in the same frame.
      void container.getBoundingClientRect();
      toPlay.forEach((el) => {
        el.style.transform = '';
        el.style.transition = `transform ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;

        // Hand styling back to React once the slide finishes.
        const cleanup = (e: TransitionEvent) => {
          if (e.propertyName === 'transform') {
            el.style.transform = '';
            el.style.transition = '';
            el.removeEventListener('transitionend', cleanup);
          }
        };
        el.addEventListener('transitionend', cleanup);
      });
    });

    return () => {
      cancelAnimationFrame(measureRaf);
    };
  }, [dependency, reducedMotion, onAnimatingChange]);
}
