// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { TriangleAlert } from 'lucide-react';
import { activeRestrictionsAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';

/**
 * Standing "given x ≠ 0, y ≠ 0" caveat under the main equation (#486).
 *
 * A domain restriction (#63) is a property of the whole solution *branch*, not
 * the single transition that introduced it: once a step divides by `x` assuming
 * `x ≠ 0`, every descendant equation — including the final answer — is only valid
 * under it. The introducing edge keeps its own amber badge, but the *accumulated*
 * set is surfaced here persistently so a working answer never silently drops a
 * condition it depends on. Renders nothing when the active path carries no
 * restriction, so the caveat appears exactly when it's earned.
 */
export const ActiveRestrictionsCaveat: React.FC = () => {
  const restrictions = useAtomValue(activeRestrictionsAtom);
  if (restrictions.length === 0) return null;

  return (
    <div
      role="note"
      aria-label={`Assuming ${restrictions.join(', ')}`}
      className={THEME_GLASS.ACTIVE_RESTRICTION_CAVEAT}
    >
      <TriangleAlert size={14} className={THEME_GLASS.ACTIVE_RESTRICTION_CAVEAT_ICON} aria-hidden />
      <span>given {restrictions.join(', ')}</span>
    </div>
  );
};
