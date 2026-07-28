// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React, { useEffect, useRef } from 'react';
import { PracticeGoalBanner } from './PracticeGoalBanner';
import { BifurcationBranchBanner } from './BifurcationBranchBanner';
import { ActiveRestrictionsCaveat } from './ActiveRestrictionsCaveat';
import { TerminalStateCaveat } from './TerminalStateCaveat';
import { HintDrawer } from './HintDrawer';
import { PracticeSetBanner } from './PracticeSetBanner';

export interface EquationMessageStackProps {
  readonly className?: string;
}

/**
 * Unified container for all standing equation status banners docked below the canvas (#569).
 *
 * Enforces explicit priority sequence for message banners:
 * 1. Goal banner (problem target)
 * 2. Active restrictions caveat (domain constraints)
 * 3. Terminal state caveat (halt/freeze reason)
 * 4. Hint drawer (step guidance)
 * 5. Practice set banner (completion & next problem loop)
 *
 * Sits in Layer 2 below the centered equation line. While banners fit in the open space
 * below the equation, the equation stays 100% stationary in optical center. If the banner
 * stack height exceeds available bottom clearance, the threshold controller translates the
 * equation upward smoothly by the exact overflow delta so all banners remain visible.
 */
export const EquationMessageStack: React.FC<EquationMessageStackProps> = ({
  className = '',
}) => {
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stackEl = stackRef.current;
    if (!stackEl || typeof window === 'undefined' || !window.ResizeObserver) return;

    const updateLayoutShift = () => {
      const eqContainerEl = stackEl.parentElement?.parentElement;
      const canvasEl = eqContainerEl?.parentElement;

      if (!canvasEl || !eqContainerEl) return;

      const canvasRect = canvasEl.getBoundingClientRect();
      const stackRect = stackEl.getBoundingClientRect();

      if (stackRect.height === 0) {
        eqContainerEl.style.transform = 'translateY(0px)';
        return;
      }

      // Temporarily read un-transformed equation bottom position
      const currentTransform = eqContainerEl.style.transform;
      eqContainerEl.style.transform = 'translateY(0px)';
      const unshiftedEqRect = eqContainerEl.getBoundingClientRect();
      eqContainerEl.style.transform = currentTransform;

      // Available space between centered equation bottom and canvas bottom boundary
      const availableBottomSpace = Math.max(0, canvasRect.bottom - unshiftedEqRect.bottom - 24);
      const overflow = stackRect.height - availableBottomSpace;

      if (overflow > 0) {
        eqContainerEl.style.transform = `translateY(-${Math.round(overflow)}px)`;
      } else {
        eqContainerEl.style.transform = 'translateY(0px)';
      }
    };

    const observer = new ResizeObserver(updateLayoutShift);
    observer.observe(stackEl);
    window.addEventListener('resize', updateLayoutShift);
    updateLayoutShift();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayoutShift);
      if (stackEl.parentElement?.parentElement) {
        stackEl.parentElement.parentElement.style.transform = 'translateY(0px)';
      }
    };
  }, []);

  return (
    <div
      ref={stackRef}
      className={`flex flex-col items-center justify-start gap-1.5 w-full max-w-xl mx-auto px-4 transition-all duration-300 ease-in-out select-none ${className}`.trim()}
    >
      <PracticeGoalBanner />
      <BifurcationBranchBanner />
      <ActiveRestrictionsCaveat />
      <TerminalStateCaveat />
      <HintDrawer />
      <PracticeSetBanner />
    </div>
  );
};
