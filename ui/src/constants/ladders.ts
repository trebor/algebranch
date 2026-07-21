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
    description: 'Master 1-step and 2-step linear equations, negative coefficients, distribution, and multi-step terms.',
    presetIds: [
      'linear_basic',
      'linear_negative',
      'linear_both_sides',
      'linear_distribution',
      'linear_multi_step',
    ],
  },
  {
    id: 'powers_roots',
    title: 'Powers & Radical Equations',
    description: 'Solve equations with exponents and square roots by isolating power/radical terms and taking roots/powers.',
    presetIds: [
      'quadratic_basic_solve',
      'quadratic_radical',
      'radical_linear',
      'radical_equal_roots',
      'radical_quadratic',
    ],
  },
  {
    id: 'identities_factoring',
    title: 'Algebraic Identities & Factoring',
    description: 'Apply conjugate binomial identities, GCF factoring, monic/general quadratic factoring, and formula.',
    presetIds: [
      'quadratic_factor_gcf',
      'quadratic_factor_monic',
      'quadratic_factor_general',
      'quadratic_constant_solve',
      'complex_quadratic_formula',
    ],
  },
  {
    id: 'global_rationals',
    title: 'Global Operations & Rationals',
    description: 'Clear denominators and solve rational expressions using global multiplication and proportion rules.',
    presetIds: [
      'fraction_coefficients',
      'rational_basic',
      'rational_proportion',
      'rational_sum',
      'exponent_basic',
    ],
  },
  {
    id: 'substitution_systems',
    title: 'Substitution & Exponents',
    description: 'Practice multi-variable substitution, logarithmic exponent isolation, and complex variable roots.',
    presetIds: [
      'exponent_log_solve',
      'log_basic',
      'complex_basic',
      'complex_linear',
      'linear_both_sides',
    ],
  },
];

/**
 * Maps each tutorial chapter to its 1:1 matching Practice Set.
 */
export const getPracticeSetForChapter = (chapterId: string): PracticeSet => {
  const map: Record<string, string> = {
    linear: 'linear_basics',
    complex: 'powers_roots',
    identities: 'identities_factoring',
    global: 'global_rationals',
    substitution: 'substitution_systems',
  };
  const targetId = map[chapterId] ?? PRACTICE_SETS[0].id;
  const found = PRACTICE_SETS.find((s) => s.id === targetId);
  return found ?? PRACTICE_SETS[0];
};
