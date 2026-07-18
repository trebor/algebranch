// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

export const EVALUATE_TO_DECIMAL_LABEL = 'Evaluate to Decimal';

export interface NodeWithLabel {
  label: string;
}

export interface CapabilityGateDefinition {
  key: 'allowComplex' | 'allowEvaluateToDecimal' | 'progressiveMode';
  label: string;
  description: string;
  /**
   * Returns a lock explanation string if the active workspace has used this capability
   * (which forces the toggle to be checked/enabled and disabled from user input),
   * or null if the capability is free to toggle.
   */
  checkLock: (equations: string[], nodes: NodeWithLabel[]) => string | null;
}

export const CAPABILITY_GATES: CapabilityGateDefinition[] = [
  {
    key: 'allowEvaluateToDecimal',
    label: 'Allow decimals',
    description: 'Allow simplifying subtrees to decimal floats (e.g. 3/4 → 0.75).',
    checkLock: (_equations, nodes) => {
      const hasDecimalEvaluation = nodes.some((node) => node.label === EVALUATE_TO_DECIMAL_LABEL);
      return hasDecimalEvaluation
        ? "Locked to 'Allowed' because your shared derivation already evaluates fractions to decimals."
        : null;
    },
  },
  {
    key: 'allowComplex',
    label: 'Allow complex numbers',
    description: 'Offer complex steps when a negative square root appears (e.g. √−4 → 2ⅈ).',
    checkLock: (equations) => {
      const hasComplex = equations.some((eqStr) => eqStr.includes('ⅈ'));
      return hasComplex
        ? "Locked to 'Allowed' because your shared derivation contains complex numbers."
        : null;
    },
  },
  {
    key: 'progressiveMode',
    label: 'Progressive simplification',
    description: 'Requires simplifying expressions step-by-step from the inside out.',
    checkLock: () => null,
  },
];
