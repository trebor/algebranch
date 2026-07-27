// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { TriangleAlert } from 'lucide-react';
import { activeRestrictionsAtom } from '../store/equation';
import { EquationBanner } from './EquationBanner';

/**
 * Standing "given x ≠ 0, y ≠ 0" caveat under the main equation (#486).
 * Refactored to use the unified EquationBanner primitive (#569).
 */
export const ActiveRestrictionsCaveat: React.FC = () => {
  const restrictions = useAtomValue(activeRestrictionsAtom);
  if (restrictions.length === 0) return null;

  return (
    <EquationBanner
      variant="amber"
      role="note"
      ariaLabel={`Assuming ${restrictions.join(', ')}`}
      icon={<TriangleAlert size={14} aria-hidden />}
    >
      <span>given {restrictions.join(', ')}</span>
    </EquationBanner>
  );
};
