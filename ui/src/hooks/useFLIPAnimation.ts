// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { THEME_ANIMATIONS } from '../constants/theme';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useFLIPAnimation(
  containerRef: React.RefObject<HTMLDivElement | null>,
  dependency: unknown
) {
  const boundingBoxRef = useRef<Map<string, DOMRect>>(new Map());

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = Array.from(container.querySelectorAll('[data-flip-id]')) as HTMLElement[];
    const firstRects = boundingBoxRef.current;
    const lastRects = new Map<string, DOMRect>();

    // 1. First Pass: Capture all new positions (Last)
    elements.forEach((el) => {
      const id = el.getAttribute('data-flip-id');
      if (id) {
        lastRects.set(id, el.getBoundingClientRect());
      }
    });

    // Map to keep track of calculated translations to prevent double translation in nested structures
    const appliedTranslations = new Map<string, { dx: number; dy: number }>();

    // 2. Second Pass: Invert and Play
    elements.forEach((el) => {
      const id = el.getAttribute('data-flip-id');
      if (!id) return;

      const firstRect = firstRects.get(id);
      const lastRect = lastRects.get(id);

      if (firstRect && lastRect) {
        // Calculate viewport-space deltas
        const viewportDx = firstRect.left - lastRect.left;
        const viewportDy = firstRect.top - lastRect.top;

        if (viewportDx !== 0 || viewportDy !== 0) {
          // Find the nearest ancestor that is also active and has a stable ID
          let ancestor: HTMLElement | null = el.parentElement;
          let nearestAncestorId: string | null = null;

          while (ancestor && ancestor !== container) {
            const ancestorId = ancestor.getAttribute('data-flip-id');
            if (ancestorId && firstRects.has(ancestorId)) {
              nearestAncestorId = ancestorId;
              break;
            }
            ancestor = ancestor.parentElement;
          }

          // Solve the Nested Transform Problem:
          // Subtract the ancestor's translation to prevent compounding layout transforms!
          let dx = viewportDx;
          let dy = viewportDy;

          if (nearestAncestorId) {
            const ancestorTrans = appliedTranslations.get(nearestAncestorId);
            if (ancestorTrans) {
              dx -= ancestorTrans.dx;
              dy -= ancestorTrans.dy;
            }
          }

          // Store the translation we are applying to this node
          appliedTranslations.set(id, { dx: viewportDx, dy: viewportDy });

          if (dx !== 0 || dy !== 0) {
            // INVERT: Put element back to its starting position instantly
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            el.style.transition = 'none';

            // PLAY: Animate it smoothly to its new layout position
            requestAnimationFrame(() => {
              el.style.transform = '';
              el.style.transition = `transform ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms cubic-bezier(0.25, 1, 0.5, 1)`;

              // Clean up styles to restore React control after animation completes
              const cleanup = (e: TransitionEvent) => {
                if (e.propertyName === 'transform') {
                  el.style.transform = '';
                  el.style.transition = '';
                  el.removeEventListener('transitionend', cleanup);
                }
              };
              el.addEventListener('transitionend', cleanup);
            });
          }
        }
      }
    });

    // 3. Update Ref Map with current coordinates for the next render
    boundingBoxRef.current = lastRects;
  }, [dependency]);
}
