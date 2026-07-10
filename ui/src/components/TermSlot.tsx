// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { THEME_GLASS } from '../constants/theme';

/**
 * The generic term placeholder (#491): an empty dashed rounded socket standing
 * for "whichever term/side lands here" in operation previews — ( )^n, √( ),
 * the reciprocal hops, the radial power preview. Echoes the app's drag-target
 * visual language, replacing the old typed-parentheses `( )` idiom. Decorative
 * only (the accompanying sentence carries the meaning), hence aria-hidden.
 */
export const TermSlot: React.FC = () => (
  <span aria-hidden className={THEME_GLASS.TERM_SLOT} />
);
