// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

// Module-scope so it's a stable, recognizable hook (not a per-render
// conditional alias): layout effect on the client, plain effect on the server
// to avoid the SSR useLayoutEffect warning.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Event handlers Tooltip reads off / re-injects into its trigger child. */
interface TriggerProps {
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  onClick?: (e: React.MouseEvent) => boolean | void;
}

interface TooltipProps {
  readonly content: React.ReactNode;
  readonly children: React.ReactElement<TriggerProps>;
  readonly position?: 'top' | 'bottom' | 'left' | 'right';
  readonly delay?: number; // Delay in milliseconds before showing
  readonly hideDelay?: number; // Grace period (ms) before hiding, to bridge the trigger->popover gap
  readonly className?: string; // Optional popover class overrides
  readonly wrapperClassName?: string; // Optional wrapper container class overrides
  readonly style?: React.CSSProperties; // Optional wrapper container styles
  readonly autoAlign?: boolean; // Dynamic horizontal screen alignment
  readonly visible?: boolean; // Controlled visibility
}

/**
 * A premium, reusable, layout-safe glassmorphic Tooltip wrapper.
 * Uses React Portals to render directly into document.body, making it 100% immune to parent overflow: hidden/auto clipping.
 * Employs position: fixed and CSS transform calculations for layout-agnostic, pinpoint accuracy.
 * Promotes stacking layer automatically with scroll-capture listener to dismiss tooltips on viewport scrolling.
 * Compliant with WCAG 1.4.13 (Dismissible, Hoverable, and Persistent).
 */
// Module-level global to keep track of the currently active tooltip's dismiss function
let activeTooltipClose: (() => void) | null = null;
// Pending (delayed) show cancellers. The first tooltip to actually appear aborts
// every other still-pending show, so a parent tooltip (e.g. a tree node card) can't
// "steal" focus a beat after a nested child tooltip (e.g. a corner badge) has opened.
const pendingTooltipShows = new Set<() => void>();

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 150, // Snappy 150ms default delay
  hideDelay = 150, // Default hover-bridge grace before hiding
  className = '',
  wrapperClassName = '',
  style,
  autoAlign = true,
  visible,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const isShown = (visible !== undefined ? visible : isVisible) && !isDismissed;

  const [calculatedPosition, setCalculatedPosition] = useState<'top' | 'bottom' | 'left' | 'right'>(position);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const showCancelRef = React.useRef<(() => void) | null>(null);
  const [adjustedLeft, setAdjustedLeft] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!isShown) {
      setAdjustedLeft(null);
      return;
    }

    const tooltipEl = tooltipRef.current;
    if (!tooltipEl) return;

    const rect = tooltipEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Determine horizontal shift if tooltip overflows viewport edges
    let shift = 0;
    if (rect.left < 8) {
      shift = 8 - rect.left;
    } else if (rect.right > viewportWidth - 8) {
      shift = viewportWidth - 8 - rect.right;
    }

    if (shift !== 0) {
      setAdjustedLeft(coords.left + shift);
    } else {
      setAdjustedLeft(coords.left);
    }
  }, [isShown, coords.left, calculatedPosition]);

  const [showTimeoutId, setShowTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [hideTimeoutId, setHideTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const closeSelf = React.useCallback(() => {
    setIsVisible(false);
    setIsDismissed(true);
  }, []);

  // Clear the dismissed flag when controlled visibility turns on — done during
  // render (previous-prop pattern) so it isn't a synchronous setState in the
  // coordination effect below.
  const [prevControlledVisible, setPrevControlledVisible] = useState(visible);
  if (visible !== prevControlledVisible) {
    setPrevControlledVisible(visible);
    if (visible === true) setIsDismissed(false);
  }

  // React to visibility changes in controlled mode
  useEffect(() => {
    if (visible === true) {
      if (activeTooltipClose && activeTooltipClose !== closeSelf) {
        activeTooltipClose();
      }
      activeTooltipClose = closeSelf;
    } else if (visible === false) {
      const handle = requestAnimationFrame(() => {
        setIsVisible(false);
        setIsDismissed(false);
        if (activeTooltipClose === closeSelf) {
          activeTooltipClose = null;
        }
        setShowTimeoutId(prev => {
          if (prev) clearTimeout(prev);
          return null;
        });
        setHideTimeoutId(prev => {
          if (prev) clearTimeout(prev);
          return null;
        });
      });
      return () => cancelAnimationFrame(handle);
    }
  }, [visible, closeSelf]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeTooltipClose === closeSelf) {
        activeTooltipClose = null;
      }
    };
  }, [closeSelf]);

  // Safely mount to prevent SSR hydration mismatches
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  // On unmount, drop any still-pending show canceller so it can't linger in the
  // module-level registry after this tooltip is gone.
  useEffect(() => {
    return () => {
      if (showCancelRef.current) {
        pendingTooltipShows.delete(showCancelRef.current);
        showCancelRef.current = null;
      }
    };
  }, []);

  // Dismiss tooltip instantly upon scrolling any container in the viewport
  useEffect(() => {
    if (!isVisible) return;
    const handleScroll = () => {
      setIsVisible(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isVisible]);

  const showTooltip = (e: React.MouseEvent<Element> | React.FocusEvent<Element>) => {
    setIsDismissed(false);
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const triggerCenterX = rect.left + rect.width / 2;
      const triggerCenterY = rect.top + rect.height / 2;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const isNarrow = viewportWidth < 768;
      let optimalDir = position;

      if (autoAlign) {
        if (isNarrow) {
          // On mobile, prefer top/bottom to prevent horizontal clipping
          optimalDir = triggerCenterY > viewportHeight / 2 ? 'top' : 'bottom';
        } else {
          // On desktop, prefer left/right based on screen half
          optimalDir = triggerCenterX > viewportWidth / 2 ? 'left' : 'right';
        }
      }
        
      setCalculatedPosition(optimalDir);

      const offset = 12; // Pixels visual offset gap (increased from 8px for better breathing room)
      let top = 0;
      let left = 0;

      if (optimalDir === 'left') {
        top = triggerCenterY;
        left = rect.left - offset;
      } else if (optimalDir === 'right') {
        top = triggerCenterY;
        left = rect.right + offset;
      } else if (optimalDir === 'top') {
        top = rect.top - offset;
        left = triggerCenterX;
      } else {
        top = rect.bottom + offset;
        left = triggerCenterX;
      }

      // Clamp horizontal coordinates for top/bottom tooltips to prevent edge clipping
      if (optimalDir === 'top' || optimalDir === 'bottom') {
        const halfWidth = 100; // max-w-[200px] / 2
        left = Math.max(halfWidth + 8, Math.min(left, viewportWidth - halfWidth - 8));
      }

      setCoords({ top, left });
    } catch (err) {
      console.error('Failed to compute dynamic tooltip position:', err);
    }

    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      setHideTimeoutId(null);
    }
    // A controlled-OFF tooltip (owner passed visible={false}) still positions
    // itself above, but must NOT run the hover-driven show: it can never appear,
    // and claiming the global single-active slot would dismiss whatever IS shown.
    // This matters on touch, where a tap synthesizes mouseenters across the
    // pressed node's neighbours — each wrapped in a visible={false} <Tooltip> —
    // whose stray shows would otherwise tear down the long-press peek a beat
    // after it appears (#388). Controlled-ON tooltips drive visibility from the
    // prop + its effect, so they don't need this timer either.
    if (visible !== undefined) return;
    if (showTimeoutId) return;
    const id = setTimeout(() => {
      pendingTooltipShows.delete(cancelPending);
      // Abort every other still-pending show so none can supersede us a beat later.
      pendingTooltipShows.forEach((cancel) => cancel());
      // Dismiss any other open tooltip globally before showing this one
      if (activeTooltipClose && activeTooltipClose !== closeSelf) {
        activeTooltipClose();
      }
      setIsVisible(true);
      activeTooltipClose = closeSelf;
    }, delay);
    const cancelPending = () => {
      clearTimeout(id);
      pendingTooltipShows.delete(cancelPending);
      setShowTimeoutId(null);
    };
    showCancelRef.current = cancelPending;
    pendingTooltipShows.add(cancelPending);
    setShowTimeoutId(id);
  };

  const hideTooltip = () => {
    if (showCancelRef.current) {
      pendingTooltipShows.delete(showCancelRef.current);
      showCancelRef.current = null;
    }
    if (showTimeoutId) {
      clearTimeout(showTimeoutId);
      setShowTimeoutId(null);
    }
    if (hideTimeoutId) return;
    // Hover-bridge grace period to cross from trigger into tooltip popover safely
    const id = setTimeout(() => {
      setIsVisible(false);
      if (activeTooltipClose === closeSelf) {
        activeTooltipClose = null;
      }
      setHideTimeoutId(null);
    }, hideDelay);
    setHideTimeoutId(id);
  };

  const cancelHide = () => {
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      setHideTimeoutId(null);
    }
  };

  // Directional arrow classes
  const arrowClasses = {
    top: 'absolute top-full left-1/2 -translate-x-1/2 border-t-neutral-950/95 border-x-transparent border-b-transparent',
    bottom: 'absolute bottom-full left-1/2 -translate-x-1/2 border-b-neutral-950/95 border-x-transparent border-t-transparent',
    left: 'absolute left-full top-1/2 -translate-y-1/2 border-l-neutral-950/95 border-y-transparent border-r-transparent',
    right: 'absolute right-full top-1/2 -translate-y-1/2 border-r-neutral-950/95 border-y-transparent border-l-transparent',
  };

  // Safely clone children to inject events
  const trigger = React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      showTooltip(e);
      if (children.props.onMouseEnter) {
        children.props.onMouseEnter(e);
      }
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hideTooltip();
      if (children.props.onMouseLeave) {
        children.props.onMouseLeave(e);
      }
    },
    onFocus: (e: React.FocusEvent) => {
      showTooltip(e);
      if (children.props.onFocus) {
        children.props.onFocus(e);
      }
    },
    onBlur: (e: React.FocusEvent) => {
      setIsVisible(false);
      if (activeTooltipClose === closeSelf) {
        activeTooltipClose = null;
      }
      if (children.props.onBlur) {
        children.props.onBlur(e);
      }
    },
    onClick: (e: React.MouseEvent) => {
      if (!children.props.onClick || children.props.onClick(e) !== false) {
        setIsVisible(false);
        if (activeTooltipClose === closeSelf) {
          activeTooltipClose = null;
        }
        if (showTimeoutId) clearTimeout(showTimeoutId);
        if (hideTimeoutId) clearTimeout(hideTimeoutId);
        setShowTimeoutId(null);
        setHideTimeoutId(null);
      }
    },
  });

  const hasPointerEvents = className.includes('pointer-events-auto');
  const pointerClass = hasPointerEvents ? 'pointer-events-auto' : 'pointer-events-none';

  const hasPadding = className.includes('p-') || className.includes('px-') || className.includes('py-');
  const paddingClass = hasPadding ? '' : 'px-3 py-1.5';

  const hasWidth = className.includes('w-') || className.includes('max-w-');
  const widthClass = hasWidth ? '' : 'max-w-[240px] text-center';

  const hasTextSize = className.includes('text-');
  const textClass = hasTextSize ? '' : 'text-sm';

  const tooltipPortal = isShown && mounted && typeof document !== 'undefined' && createPortal(
    <div
      ref={tooltipRef}
      onMouseEnter={cancelHide}
      onMouseLeave={hideTooltip}
      style={{
        position: 'fixed',
        left: `${adjustedLeft !== null ? adjustedLeft : coords.left}px`,
        top: `${coords.top}px`,
        transform: 
          calculatedPosition === 'left' ? 'translate(-100%, -50%)' :
          calculatedPosition === 'right' ? 'translate(0, -50%)' :
          calculatedPosition === 'top' ? 'translate(-50%, -100%)' :
          'translate(-50%, 0)',
        zIndex: 9999, // Guarantee absolute topmost visual layer
      }}
      className={`${pointerClass} ${paddingClass} ${widthClass} ${textClass} select-text rounded-lg border border-white/10 bg-neutral-950/95 backdrop-blur-md text-indigo-200 shadow-2xl shadow-[0_0_30px_rgba(129,140,248,0.45)] transition-all duration-150 animate-in fade-in zoom-in-95 ${className}`}
      role="tooltip"
    >
      {content}
      <div 
        className={`border-4 ${arrowClasses[calculatedPosition]}`} 
        style={
          (calculatedPosition === 'top' || calculatedPosition === 'bottom') && adjustedLeft !== null
            ? { transform: `translate(calc(-50% + ${coords.left - adjustedLeft}px), 0)` }
            : undefined
        }
      />
    </div>,
    document.body
  );

  const isAbsoluteOrFixed = wrapperClassName.includes('absolute') || wrapperClassName.includes('fixed');
  const baseWrapperClass = isAbsoluteOrFixed
    ? 'inline-flex items-center justify-center'
    : 'relative inline-flex items-center justify-center';

  return (
    <div
      className={`${baseWrapperClass} ${wrapperClassName}`}
      style={style}
    >
      {trigger}
      {tooltipPortal}
    </div>
  );
};
