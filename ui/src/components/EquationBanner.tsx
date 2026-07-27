// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { THEME_GLASS } from '../constants/theme';

export type EquationBannerVariant = 'amber' | 'red' | 'emerald' | 'sky' | 'gold';

export interface EquationBannerProps {
  readonly variant?: EquationBannerVariant;
  readonly icon?: React.ReactNode;
  readonly ariaLabel?: string;
  readonly role?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}

/**
 * Unified primitive for equation status messages docked below the canvas (#569).
 *
 * Provides standard flex layout, accessibility attributes, theme styling variants,
 * and icon positioning for all standing banners and caveats.
 */
export const EquationBanner: React.FC<EquationBannerProps> = ({
  variant = 'amber',
  icon,
  ariaLabel,
  role = 'note',
  children,
  className = '',
}) => {
  const variantClass = THEME_GLASS.EQUATION_BANNER_VARIANTS[variant] ?? THEME_GLASS.EQUATION_BANNER_VARIANTS.amber;
  const iconVariantClass = THEME_GLASS.EQUATION_BANNER_ICON_VARIANTS[variant] ?? THEME_GLASS.EQUATION_BANNER_ICON_VARIANTS.amber;

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={`${THEME_GLASS.EQUATION_BANNER_BASE} ${variantClass} ${className}`.trim()}
    >
      {icon && <span className={iconVariantClass}>{icon}</span>}
      {children}
    </div>
  );
};
