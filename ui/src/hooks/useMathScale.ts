'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Equation } from 'math-engine-client';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useMathScale(
  currentEq: Equation | null,
  dependencies: unknown[] = [],
  extraBuffer = 24,
  minScale = 0.4
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const adjustScale = () => {
      // 1. Reset scale temporarily to measure natural boundaries
      content.style.fontSize = '1em';
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;

      if (contentWidth > 0 && containerWidth > 0 && contentHeight > 0 && containerHeight > 0) {
        // 2. Read computed padding dynamically from the container
        const style = window.getComputedStyle(container);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;

        const paddingX = paddingLeft + paddingRight + extraBuffer;
        const paddingY = paddingTop + paddingBottom + extraBuffer;

        // 3. Calculate scale ratios for both dimensions
        const targetWidthScale = (containerWidth - paddingX) / contentWidth;
        const targetHeightScale = (containerHeight - paddingY) / contentHeight;
        
        // 4. Select the smaller scale to guarantee fitting in both directions
        const targetScale = Math.min(targetWidthScale, targetHeightScale);
        const clampedScale = Math.max(minScale, Math.min(1, targetScale));
        
        // 5. Set state and apply directly to DOM to prevent layout loops
        setScale(clampedScale);
        content.style.fontSize = `${clampedScale}em`;
      }
    };

    // Run adjustment immediately
    adjustScale();

    // Attach ResizeObserver to handle container shifts (sidebar toggle, window resize)
    const observer = new ResizeObserver(() => adjustScale());
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [currentEq, extraBuffer, minScale, ...dependencies]);

  return { containerRef, contentRef, scale };
}
