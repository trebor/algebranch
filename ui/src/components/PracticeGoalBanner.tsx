// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { Target } from 'lucide-react';
import { parseEquation } from 'math-engine';
import { getUniqueVariables } from 'math-engine-client';
import { activePracticeSetAtom, readyForNextProblemAtom, practiceSetProgressAtom } from '../store/ladders';
import { currentEquationAtom, historyTreeAtom } from '../store/equation';
import { PRESET_LIST } from '../constants/presets';
import { THEME_GLASS } from '../constants/theme';
import { splitSubscript } from '../constants/mathSymbols';
import { EquationBanner } from './EquationBanner';

/**
 * Standing Practice Set Goal Banner docked under the main equation canvas (#564).
 *
 * Appears persistently while a practice equation is active and unsolved. Displays
 * the explicit, targeted goal for the active problem (e.g. "Goal: Isolate x"),
 * rendering the target variable in bold math-serif typography. Automatically hides
 * when the equation reaches a solved state so the PracticeSetBanner can take over.
 */
export const PracticeGoalBanner: React.FC = () => {
  const active = useAtomValue(activePracticeSetAtom);
  const readyForNext = useAtomValue(readyForNextProblemAtom);
  const currentEquation = useAtomValue(currentEquationAtom);
  const progress = useAtomValue(practiceSetProgressAtom);
  const tree = useAtomValue(historyTreeAtom);

  if (!active || readyForNext) return null;

  const { set, position } = active;

  // Verify that the active tab's root equation matches the active practice problem
  const expectedEqStr = progress.generatedEquations?.[set.id]?.[position];
  if (expectedEqStr && tree['0']) {
    try {
      const rootEq = tree['0'].equation;
      const expectedEq = parseEquation(expectedEqStr);
      const rootVars = getUniqueVariables(rootEq);
      const expectedVars = getUniqueVariables(expectedEq);
      if (rootVars.length !== expectedVars.length) {
        return null;
      }
    } catch {
      /* ignore */
    }
  }

  const presetId = set.presetIds[position];
  const preset = PRESET_LIST.find((p) => p.id === presetId);

  // Extract the primary variable symbol from the active equation
  let targetVar = 'x';
  if (currentEquation) {
    const vars = getUniqueVariables(currentEquation);
    if (vars.length > 0) {
      targetVar = vars[0];
    }
  }

  const template = preset?.goalTemplate ?? 'Isolate {var}';
  const parts = template.split('{var}');
  const prefix = parts[0] ?? '';
  const suffix = parts[1] ?? '';
  const { head, sub } = splitSubscript(targetVar);
  const ariaLabel = `Goal: ${template.replace('{var}', targetVar)}`;

  return (
    <EquationBanner
      variant="sky"
      role="note"
      ariaLabel={ariaLabel}
      icon={<Target size={14} aria-hidden />}
    >
      <span>
        Goal: {prefix}
        <span className="text-sm font-serif italic font-bold text-sky-100 px-0.5">
          {head}
          {sub !== null && <sub className={THEME_GLASS.MATH_SUBSCRIPT}>{sub}</sub>}
        </span>
        {suffix}
      </span>
    </EquationBanner>
  );
};
