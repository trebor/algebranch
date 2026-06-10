'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Equation } from 'math-engine-client';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * useMathScale — Calculates and applies a dynamic scale factor to make equation expressions
 * fit perfectly within the boundaries of their container.
 *
 * Prevents recursive ResizeObserver infinite layout loops by:
 * 1. Resetting font-size to 1em temporarily inside the layout logic to measure the true natural size.
 * 2. Only triggering recalculations in the ResizeObserver if the container's width/height
 *    actually changes by more than 1 pixel. This stops child styling changes from causing loops.
 */
export function useMathScale(
  currentEq: Equation | null,
  dependencies: unknown[] = [],
  extraBuffer = 24,
  minScale = 0.4,
  maxScale = 2.8
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  
  // Track container dimensions to prevent ResizeObserver loops from sub-pixel child layout shifts
  const lastWidthRef = useRef(0);
  const lastHeightRef = useRef(0);

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const adjustScale = () => {
      // 1. Reset scale temporarily to measure natural boundaries accurately
      content.style.fontSize = '1em';

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      if (containerWidth <= 0 || containerHeight <= 0) return;

      const naturalWidth = content.scrollWidth;
      const naturalHeight = content.scrollHeight;

      if (naturalWidth <= 0 || naturalHeight <= 0) return;

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
      
      // 4. Apply scale to the DOM and react state
      setScale(clampedScale);
      content.style.fontSize = `${clampedScale}em`;
    };

    // Run adjustment immediately
    adjustScale();

    // Schedule a settled measurement after animations/transitions complete to resolve race conditions
    const settleTimer = setTimeout(adjustScale, 380);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          // Only trigger if container dimensions change significantly (ignores child font-size updates)
          if (Math.abs(width - lastWidthRef.current) > 1 || Math.abs(height - lastHeightRef.current) > 1) {
            lastWidthRef.current = width;
            lastHeightRef.current = height;
            adjustScale();
          }
        }
      });
      observer.observe(container);
    } else {
      const handleResize = () => adjustScale();
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(settleTimer);
      };
    }

    return () => {
      clearTimeout(settleTimer);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [currentEq, extraBuffer, minScale, maxScale, ...dependencies]);

  return { containerRef, contentRef, scale };
}
