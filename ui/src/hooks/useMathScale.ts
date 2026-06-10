'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Equation } from 'math-engine-client';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * useMathScale — Calculates and applies a dynamic scale factor to make equation expressions
 * fit perfectly within the boundaries of their container.
 *
 * Prevents recursive ResizeObserver infinite layout loops by:
 * 1. Deriving natural (unscaled) size mathematically (rendered size / scale)
 *    instead of thrashing the DOM by resetting font-size to '1em' on every callback.
 * 2. Applying a small tolerance threshold (1%) to ignore trivial/sub-pixel dimensions updates.
 */
export function useMathScale(
  currentEq: Equation | null,
  dependencies: unknown[] = [],
  extraBuffer = 24,
  minScale = 0.4,
  maxScale = 3.0
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    let currentAppliedScale = 1;

    const adjustScale = (force = false) => {
      if (force) {
        currentAppliedScale = 1;
        content.style.fontSize = '1em';
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      if (containerWidth <= 0 || containerHeight <= 0) return;

      const renderedWidth = content.scrollWidth;
      const renderedHeight = content.scrollHeight;

      if (renderedWidth <= 0 || renderedHeight <= 0) return;

      // 1. Derively calculate natural size from current applied scale
      const naturalWidth = renderedWidth / currentAppliedScale;
      const naturalHeight = renderedHeight / currentAppliedScale;

      // 2. Read padding to calculate available canvas area
      const style = window.getComputedStyle(container);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;

      const paddingX = extraBuffer === 0 ? 0 : (paddingLeft + paddingRight + extraBuffer);
      const paddingY = extraBuffer === 0 ? 0 : (paddingTop + paddingBottom + extraBuffer);

      // 3. Compute target scales for both axes
      const targetWidthScale = (containerWidth - paddingX) / naturalWidth;
      const targetHeightScale = (containerHeight - paddingY) / naturalHeight;
      
      const targetScale = Math.min(targetWidthScale, targetHeightScale);
      const clampedScale = Math.max(minScale, Math.min(maxScale, targetScale));
      
      // 4. Skip updates if difference is negligible (<1%) to avoid loop oscillation
      if (force || Math.abs(clampedScale - currentAppliedScale) > 0.01) {
        currentAppliedScale = clampedScale;
        setScale(clampedScale);
        content.style.fontSize = `${clampedScale}em`;
      }
    };

    // Initial measurement
    adjustScale(true);

    let observer: ResizeObserver | null = null;
    const handleResize = () => adjustScale(false);

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        adjustScale(false);
      });
      observer.observe(container);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [currentEq, extraBuffer, minScale, maxScale, ...dependencies]);

  return { containerRef, contentRef, scale };
}
