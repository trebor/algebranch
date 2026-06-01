'use client';

import React, { useState } from 'react';

interface TooltipProps {
  readonly content: React.ReactNode;
  readonly children: React.ReactElement<any>;
  readonly position?: 'top' | 'bottom' | 'left' | 'right';
  readonly delay?: number; // Delay in milliseconds before showing
  readonly className?: string; // Optional popover class overrides
  readonly wrapperClassName?: string; // Optional wrapper container class overrides
  readonly style?: React.CSSProperties; // Optional wrapper container styles
  readonly autoAlign?: boolean; // Dynamic horizontal screen alignment
}

/**
 * A premium, reusable glassmorphic Tooltip wrapper.
 * Supports rich React.ReactNode content (e.g. templates, buttons, text blocks).
 * Uses a safe hover-retention gap (150ms) so you can hover inside the tooltip to click elements (WCAG 1.4.13 compliant).
 * Performs auto-alignment on the fly to center tooltips relative to the viewport.
 * Dynamically promotes wrapper z-index (to zIndex: 100) when active to resolve absolute stacking contexts.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 150, // Snappy 150ms default delay for high responsiveness
  className = '',
  wrapperClassName = '',
  style,
  autoAlign = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [calculatedPosition, setCalculatedPosition] = useState<'top' | 'bottom' | 'left' | 'right'>(position);
  const [showTimeoutId, setShowTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [hideTimeoutId, setHideTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = (e: React.MouseEvent<any> | React.FocusEvent<any>) => {
    // Perform dynamic vertical/horizontal alignment on the fly
    if (autoAlign) {
      try {
        const rect = e.currentTarget.getBoundingClientRect();
        const triggerCenterX = rect.left + rect.width / 2;
        const viewportWidth = window.innerWidth;
        
        // If trigger horizontal center is on the right half of the screen, open left.
        // If on the left half, open right. This always forces them towards the center of the screen!
        const optimalDir = triggerCenterX > viewportWidth / 2 ? 'left' : 'right';
        setCalculatedPosition(optimalDir);
      } catch (err) {
        console.error('Failed to compute dynamic tooltip position:', err);
      }
    } else {
      setCalculatedPosition(position);
    }

    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      setHideTimeoutId(null);
    }
    if (showTimeoutId) return;
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setShowTimeoutId(id);
  };

  const hideTooltip = () => {
    if (showTimeoutId) {
      clearTimeout(showTimeoutId);
      setShowTimeoutId(null);
    }
    if (hideTimeoutId) return;
    // Set a tiny 150ms delay before hiding to let the cursor cross the gap into the popover safely!
    const id = setTimeout(() => {
      setIsVisible(false);
      setHideTimeoutId(null);
    }, 150);
    setHideTimeoutId(id);
  };

  const cancelHide = () => {
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      setHideTimeoutId(null);
    }
  };

  // Position classes relative to trigger container
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // Directional arrow classes (subtle peak pointing to active trigger)
  const arrowClasses = {
    top: 'absolute top-full left-1/2 -translate-x-1/2 border-t-neutral-950/95 border-x-transparent border-b-transparent',
    bottom: 'absolute bottom-full left-1/2 -translate-x-1/2 border-b-neutral-950/95 border-x-transparent border-t-transparent',
    left: 'absolute left-full top-1/2 -translate-y-1/2 border-l-neutral-950/95 border-y-transparent border-r-transparent',
    right: 'absolute right-full top-1/2 -translate-y-1/2 border-r-neutral-950/95 border-y-transparent border-l-transparent',
  };

  // Safely merge and inject mouse event triggers on the child
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
      if (children.props.onBlur) {
        children.props.onBlur(e);
      }
    },
    onClick: (e: React.MouseEvent) => {
      // Hide instantly on click unless we prevent it
      if (!children.props.onClick || children.props.onClick(e) !== false) {
        setIsVisible(false);
        if (showTimeoutId) clearTimeout(showTimeoutId);
        if (hideTimeoutId) clearTimeout(hideTimeoutId);
        setShowTimeoutId(null);
        setHideTimeoutId(null);
      }
    },
  });

  // Outermost container style (supports inline overrides and dynamic z-index stacking context promotion)
  const dynamicStyle: React.CSSProperties = {
    ...style,
    ...(isVisible ? { zIndex: 100 } : {}), // Boost z-index to 100 when active to force stack to the top!
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${wrapperClassName}`}
      style={dynamicStyle}
    >
      {trigger}
      {isVisible && (
        <div
          onMouseEnter={cancelHide}
          onMouseLeave={hideTooltip}
          className={`absolute z-50 pointer-events-auto select-text rounded-lg border border-white/10 bg-neutral-950/95 backdrop-blur-md text-indigo-200 shadow-2xl transition-all duration-150 animate-in fade-in zoom-in-95 ${positionClasses[calculatedPosition]} ${className}`}
          role="tooltip"
        >
          {content}
          <div className={`border-4 ${arrowClasses[calculatedPosition]}`} />
        </div>
      )}
    </div>
  );
};
