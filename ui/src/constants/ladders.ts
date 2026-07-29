// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

export interface PracticeSet {
  id: string;
  title: string;
  description: string;
  presetIds: string[];
}

export type Ladder = PracticeSet;

export const MIN_PRACTICE_SET_LENGTH = 5;
export const MAX_PRACTICE_SET_LENGTH = 8;

export const PRACTICE_SETS: PracticeSet[] = [
  {
    id: 'linear_basics',
    title: 'Linear Equations',
    description: 'Master 1-step and 2-step linear equations, distribution, and multi-step terms.',
    presetIds: [
      'linear_basic',
      'linear_simple_sub',
      'linear_both_sides',
      'linear_distribution',
      'linear_multi_step',
    ],
  },
  {
    id: 'global_rationals',
    title: 'Global Operations & Rationals',
    description: 'Clear denominators, handle negative coefficients, and solve rational expressions using global multiplication and proportion rules.',
    presetIds: [
      'linear_negative',
      'fraction_coefficients',
      'rational_basic',
      'rational_proportion',
      'rational_sum',
    ],
  },
  {
    id: 'radical_equations',
    title: 'Radical Equations',
    description: 'Solve equations with square roots by isolating radical terms and squaring both sides globally.',
    presetIds: [
      'quadratic_radical',
      'radical_linear',
      'radical_equal_roots',
      'radical_quadratic',
      'exponent_basic',
    ],
  },
  {
    id: 'solution_branching',
    title: 'Solution Branching & Quadratics',
    description: 'Solve equations with square root extractions, even powers, and absolute values that split into multiple solution branches.',
    presetIds: [
      'quadratic_basic_solve',
      'complex_basic',
      'quadratic_constant_solve',
      'complex_quadratic_formula',
      'linear_both_sides',
    ],
  },
  {
    id: 'identities_factoring',
    title: 'Algebraic Identities & Factoring',
    description: 'Apply conjugate binomial identities, GCF factoring, and monic or general quadratic factoring into zero-product branches.',
    presetIds: [
      'quadratic_factor_gcf',
      'quadratic_factor_monic',
      'quadratic_factor_general',
      'quadratic_basic_solve',
      'quadratic_constant_solve',
    ],
  },
  {
    id: 'substitution_systems',
    title: 'Substitution & Systems',
    description: 'Practice multi-variable substitution, logarithmic exponent isolation, and complex variable roots.',
    presetIds: [
      'exponent_log_solve',
      'log_basic',
      'complex_linear',
      'linear_both_sides',
      'linear_multi_step',
    ],
  },
];

/**
 * Maps each tutorial chapter to its 1:1 matching Practice Set.
 */
export const getPracticeSetForChapter = (chapterId: string): PracticeSet => {
  const map: Record<string, string> = {
    linear: 'linear_basics',
    global: 'global_rationals',
    radicals: 'radical_equations',
    branching: 'solution_branching',
    identities: 'identities_factoring',
    substitution: 'substitution_systems',
    complex: 'solution_branching',
  };
  const targetId = map[chapterId] ?? PRACTICE_SETS[0].id;
  const found = PRACTICE_SETS.find((s) => s.id === targetId);
  return found ?? PRACTICE_SETS[0];
};
