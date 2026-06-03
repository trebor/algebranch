'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Equation } from 'math-engine-client';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useMathScale(
  currentEq: Equation | null,
  dependencies: unknown[] = [],
  padding = 48,
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
      const contentWidth = content.scrollWidth;

      if (contentWidth > 0 && containerWidth > 0) {
        // 2. Calculate linear scale ratio
        const targetScale = (containerWidth - padding) / contentWidth;
        const clampedScale = Math.max(minScale, Math.min(1, targetScale));
        
        // 3. Set state and apply directly to DOM to prevent layout loops
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
  }, [currentEq, padding, minScale, ...dependencies]);

  return { containerRef, contentRef, scale };
}
