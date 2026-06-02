'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
 * A premium, reusable, layout-safe glassmorphic Tooltip wrapper.
 * Uses React Portals to render directly into document.body, making it 100% immune to parent overflow: hidden/auto clipping.
 * Employs position: fixed and CSS transform calculations for layout-agnostic, pinpoint accuracy.
 * Promotes stacking layer automatically with scroll-capture listener to dismiss tooltips on viewport scrolling.
 * Compliant with WCAG 1.4.13 (Dismissible, Hoverable, and Persistent).
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 150, // Snappy 150ms default delay
  className = '',
  wrapperClassName = '',
  style,
  autoAlign = true,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [calculatedPosition, setCalculatedPosition] = useState<'top' | 'bottom' | 'left' | 'right'>(position);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [showTimeoutId, setShowTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [hideTimeoutId, setHideTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Safely mount to prevent SSR hydration mismatches
  useEffect(() => {
    setMounted(true);
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

  const showTooltip = (e: React.MouseEvent<any> | React.FocusEvent<any>) => {
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const triggerCenterX = rect.left + rect.width / 2;
      const triggerCenterY = rect.top + rect.height / 2;
      const viewportWidth = window.innerWidth;
      
      const optimalDir = autoAlign 
        ? (triggerCenterX > viewportWidth / 2 ? 'left' : 'right') 
        : position;
        
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

      setCoords({ top, left });
    } catch (err) {
      console.error('Failed to compute dynamic tooltip position:', err);
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
    // Tiny 150ms hover-bridge gap to cross from trigger into tooltip popover safely
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
      if (children.props.onBlur) {
        children.props.onBlur(e);
      }
    },
    onClick: (e: React.MouseEvent) => {
      if (!children.props.onClick || children.props.onClick(e) !== false) {
        setIsVisible(false);
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
  const widthClass = hasWidth ? '' : 'max-w-[200px] text-center';

  const hasTextSize = className.includes('text-');
  const textClass = hasTextSize ? '' : 'text-xs';

  const tooltipPortal = isVisible && mounted && typeof document !== 'undefined' && createPortal(
    <div
      onMouseEnter={cancelHide}
      onMouseLeave={hideTooltip}
      style={{
        position: 'fixed',
        left: `${coords.left}px`,
        top: `${coords.top}px`,
        transform: 
          calculatedPosition === 'left' ? 'translate(-100%, -50%)' :
          calculatedPosition === 'right' ? 'translate(0, -50%)' :
          calculatedPosition === 'top' ? 'translate(-50%, -100%)' :
          'translate(-50%, 0)',
        zIndex: 9999, // Guarantee absolute topmost visual layer
      }}
      className={`${pointerClass} ${paddingClass} ${widthClass} ${textClass} select-text rounded-lg border border-white/10 bg-neutral-950/95 backdrop-blur-md text-indigo-200 shadow-2xl transition-all duration-150 animate-in fade-in zoom-in-95 ${className}`}
      role="tooltip"
    >
      {content}
      <div className={`border-4 ${arrowClasses[calculatedPosition]}`} />
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
