// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { Zap, Split, ArrowLeftRight, Replace, TriangleAlert, Plus, Minus, Divide } from 'lucide-react';
import { THEME_GLASS } from '../constants/theme';

// Fixed size to match: 0.8em * 1.2rem = 0.96rem (15.36px)
export const HANDLE_SIZE_REM = 0.96;

export const HANDLE_THEMES = {
  simplify: {
    icon: Zap,
    handleClass: THEME_GLASS.HANDLE_SIMPLIFY,
    pingClass: THEME_GLASS.PING_SIMPLIFY,
    iconClass: 'text-neutral-950 fill-neutral-950 stroke-[2.5]',
  },
  distribute: {
    icon: Split,
    handleClass: THEME_GLASS.HANDLE_DISTRIBUTE,
    pingClass: THEME_GLASS.PING_DISTRIBUTE,
    iconClass: 'text-white stroke-[2.5]',
  },
  identity: {
    icon: ArrowLeftRight,
    handleClass: THEME_GLASS.HANDLE_IDENTITY,
    pingClass: THEME_GLASS.PING_IDENTITY,
    iconClass: 'text-white stroke-[2.5]',
  },
  substitute: {
    icon: Replace,
    handleClass: THEME_GLASS.HANDLE_SUBSTITUTE,
    pingClass: THEME_GLASS.PING_SUBSTITUTE,
    iconClass: 'text-white stroke-[2.5]',
  },
} as const;

// Corner badge design tokens to match stacking count badge
const CORNER_BADGE_FONT_SIZE = '0.4em';
const CORNER_BADGE_SIZE = '1.5em';
const CORNER_BADGE_OFFSET = '-0.8em';
const INNER_ICON_SIZE = 10;
const EXPONENT_BORDER_RADIUS = '0.12em';
const NORMAL_BORDER_RADIUS = '9999px';
const OPTICAL_CENTER_NUDGE = '0.1em';

export interface HandleBadgeProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The operation type, e.g. 'simplify', 'distribute', 'identity', 'substitute', or 'neutral' */
  opType: 'simplify' | 'distribute' | 'identity' | 'substitute' | 'neutral';
  /** If the step has restriction warning badges */
  hasRestrictionBadge?: boolean;
  /** Stacking count for multi-option stacks */
  count?: number;
  /** Fallback label for neutral type (e.g. '+', '−') */
  shortLabel?: string;
  isMath?: boolean;
  /** Tree selection border/glow states */
  isActive?: boolean;
  isHighlighted?: boolean;
  /** In exponent layout */
  inExponent?: boolean;
  /** For interactive hover/onboarding pulse animation */
  pulse?: boolean;
  /** For onboarding circle outline */
  isStackMarked?: boolean;
}

export const HandleBadge = React.forwardRef<HTMLButtonElement, HandleBadgeProps>(
  (
    {
      opType,
      hasRestrictionBadge = false,
      count,
      shortLabel = '',
      isMath = false,
      isActive = false,
      isHighlighted = false,
      inExponent = false,
      pulse = false,
      isStackMarked = false,
      className = '',
      style,
      ...props
    },
    ref,
  ) => {
    const isNeutral = opType === 'neutral';
    const theme = isNeutral ? null : HANDLE_THEMES[opType];

    const baseClass = `flex items-center justify-center transition-all duration-150 relative group select-none shadow-md ${
      theme ? theme.handleClass : 'bg-neutral-950 hover:bg-neutral-900 text-white/60 hover:text-white/90'
    } ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`;

    let stateBorderClass = '';
    if (isActive) {
      stateBorderClass = 'border border-indigo-400/80 shadow-[0_0_8px_rgba(99,102,241,0.4)]';
    } else if (isHighlighted) {
      stateBorderClass = 'border border-fuchsia-500/80 shadow-[0_0_8px_rgba(217,70,239,0.45)]';
    } else if (theme) {
      stateBorderClass = 'border border-white/5';
    } else {
      stateBorderClass = 'border border-white/10 hover:border-white/20';
    }

    const borderRadius = inExponent ? EXPONENT_BORDER_RADIUS : NORMAL_BORDER_RADIUS;
    const combinedStyle: React.CSSProperties = {
      width: `${HANDLE_SIZE_REM}rem`,
      height: `${HANDLE_SIZE_REM}rem`,
      borderRadius,
      ...style,
    };

    const renderInner = () => {
      if (theme) {
        const IconComponent = theme.icon;
        return <IconComponent className={`h-[65%] w-[65%] ${theme.iconClass}`} />;
      }

      if (shortLabel === '↔') {
        return (
          <>
            <ArrowLeftRight size={INNER_ICON_SIZE} className="text-amber-400 stroke-[2.5]" />
            <span className="sr-only">↔</span>
          </>
        );
      }

      if (shortLabel === '+') {
        return (
          <>
            <Plus size={INNER_ICON_SIZE} className="text-indigo-400 stroke-[2.5]" />
            <span className="sr-only">+</span>
          </>
        );
      }
      if (shortLabel === '−') {
        return (
          <>
            <Minus size={INNER_ICON_SIZE} className="text-violet-400 stroke-[2.5]" />
            <span className="sr-only">−</span>
          </>
        );
      }
      if (shortLabel === '/') {
        return (
          <>
            <Divide size={INNER_ICON_SIZE} className="text-pink-400 stroke-[2.5]" />
            <span className="sr-only">/</span>
          </>
        );
      }
      if (shortLabel === '⋅') {
        return <span className="text-[0.7rem] font-bold text-rose-400 leading-none">⋅</span>;
      }
      if (shortLabel === '^') {
        return <span className="text-[0.55rem] font-bold text-teal-400 leading-none tracking-tighter">xⁿ</span>;
      }
      if (shortLabel === '√') {
        return <span className="text-[0.55rem] font-bold text-emerald-400 leading-none tracking-tighter">ⁿ√</span>;
      }

      return (
        <span className={isMath ? 'font-mono text-[0.65rem] leading-none' : 'font-sans font-semibold uppercase text-[0.55rem] leading-none'}>
          {shortLabel}
        </span>
      );
    };

    const badgeCommonClass = 'absolute flex items-center justify-center rounded-full font-bold border border-white/10 bg-neutral-950 text-white leading-none pointer-events-none';

    const badgeStyle: React.CSSProperties = {
      fontSize: CORNER_BADGE_FONT_SIZE,
      height: CORNER_BADGE_SIZE,
      minWidth: CORNER_BADGE_SIZE,
    };

    const countBadgeStyle: React.CSSProperties = {
      ...badgeStyle,
      padding: '0 0.2em',
      top: CORNER_BADGE_OFFSET,
      right: CORNER_BADGE_OFFSET,
    };

    const restrictionBadgeStyle: React.CSSProperties = {
      ...badgeStyle,
      width: CORNER_BADGE_SIZE, // Fixed width ensures a perfect circle on Firefox
      bottom: CORNER_BADGE_OFFSET,
      right: CORNER_BADGE_OFFSET,
    };

    return (
      <button
        ref={ref}
        className={`${baseClass} ${stateBorderClass} ${className}`}
        style={combinedStyle}
        {...props}
      >
        {theme && (
          <span
            className={`absolute inset-0 group-hover:opacity-0 pointer-events-none ${
              pulse ? 'animate-ping' : ''
            } ${theme.pingClass}`}
            style={{ borderRadius }}
          />
        )}
        {isStackMarked && (
          <span aria-hidden="true" className={`absolute -inset-[0.3em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
        )}
        {renderInner()}

        {/* Corner Overlays */}
        {count !== undefined && count > 1 && (
          <span
            className={badgeCommonClass}
            style={countBadgeStyle}
          >
            {/* Optical-center nudge: digits have no descender, so flex/line-box
                centering leaves them riding high — push down a hair (#121). */}
            <span style={{ position: 'relative', top: OPTICAL_CENTER_NUDGE }}>{count}</span>
          </span>
        )}

        {hasRestrictionBadge && (
          <span
            className={badgeCommonClass}
            style={restrictionBadgeStyle}
          >
            <TriangleAlert className="h-[75%] w-[75%] text-amber-400 shrink-0" />
          </span>
        )}
      </button>
    );
  },
);

HandleBadge.displayName = 'HandleBadge';
