'use client';

import React, { useState } from 'react';

interface TooltipProps {
  readonly content: string;
  readonly children: React.ReactElement<any>;
  readonly position?: 'top' | 'bottom' | 'left' | 'right';
  readonly delay?: number; // Delay in milliseconds before showing
}

/**
 * A premium, reusable glassmorphic Tooltip wrapper.
 * Uses cloneElement to inject mouse triggers directly to prevent disrupting CSS layouts.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 150, // Snappy 150ms default delay for high responsiveness
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
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
      showTooltip();
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
      setIsVisible(true);
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
      hideTooltip(); // Snappily dismiss tooltip on clicking the target
      if (children.props.onClick) {
        children.props.onClick(e);
      }
    },
  });

  return (
    <div className="relative inline-flex items-center justify-center">
      {trigger}
      {isVisible && (
        <div
          className={`absolute z-50 pointer-events-none select-none text-[9px] font-medium tracking-wide uppercase whitespace-nowrap rounded-md border border-white/10 bg-neutral-950/95 backdrop-blur-md text-indigo-200 px-2 py-1 shadow-2xl transition-all duration-150 animate-in fade-in zoom-in-95 ${positionClasses[position]}`}
          role="tooltip"
        >
          {content}
          <div className={`border-4 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
};
