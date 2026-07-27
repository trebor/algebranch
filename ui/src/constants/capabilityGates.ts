// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

export const EVALUATE_TO_DECIMAL_LABEL = 'Evaluate to Decimal';

export interface NodeWithLabel {
  label: string;
}

export interface CapabilityGateDefinition {
  key: 'allowHints' | 'progressiveMode' | 'exactValues' | 'allowComplex';
  label: string;
  description: string;
  /**
   * Returns a lock explanation string if the active workspace has used this capability
   * (which forces the toggle to be checked/enabled and disabled from user input),
   * or null if the capability is free to toggle.
   */
  checkLock: (equations: string[], nodes: NodeWithLabel[]) => string | null;
  /** Value forced when locked by workspace history (default: true). */
  lockedValue?: boolean;
}

export const CAPABILITY_GATES: CapabilityGateDefinition[] = [
  {
    key: 'allowHints',
    label: 'Hints',
    description: 'Surface guided hint ladder and target operation spotlights when requested',
    checkLock: () => null,
  },
  {
    key: 'progressiveMode',
    label: 'Progressive simplification',
    description: 'Require simplifying expressions systematically from the inside out without skipping steps',
    checkLock: () => null,
  },
  {
    key: 'exactValues',
    label: 'Exact values',
    description: 'Keep fractions and radicals in exact symbolic form rather than converting to decimal values',
    checkLock: (_equations, nodes) => {
      const hasDecimalEvaluation = nodes.some((node) => node.label === EVALUATE_TO_DECIMAL_LABEL);
      return hasDecimalEvaluation
        ? "Locked to 'Disabled' because your shared derivation already evaluates fractions to decimals."
        : null;
    },
    lockedValue: false,
  },
  {
    key: 'allowComplex',
    label: 'Complex numbers',
    description: 'Offer the imaginary unit ⅈ for negative square roots such as √−4 = 2ⅈ',
    checkLock: (equations) => {
      const hasComplex = equations.some((eqStr) => eqStr.includes('ⅈ'));
      return hasComplex
        ? "Locked to 'Allowed' because your shared derivation contains complex numbers."
        : null;
    },
    lockedValue: true,
  },
];
