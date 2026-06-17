// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Interval Arithmetic Module
 * Enforces strict typing, arrow functions, and 2-space indentation.
 */

// Global Constants
const VAL_ZERO = 0;
const VAL_ONE = 1;

export interface Interval {
  readonly min: number;
  readonly max: number;
}

/**
 * Creates a new Interval.
 */
export const createInterval = (min: number, max: number): Interval => {
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  };
};

/**
 * Negates an interval: -[a, b] = [-b, -a]
 */
export const negInterval = (a: Interval): Interval => {
  return {
    min: -a.max,
    max: -a.min,
  };
};

/**
 * Adds two intervals: [a, b] + [c, d] = [a + c, b + d]
 */
export const addInterval = (a: Interval, b: Interval): Interval => {
  return {
    min: a.min + b.min,
    max: a.max + b.max,
  };
};

/**
 * Subtracts two intervals: [a, b] - [c, d] = [a - d, b - c]
 */
export const subInterval = (a: Interval, b: Interval): Interval => {
  return {
    min: a.min - b.max,
    max: a.max - b.min,
  };
};

/**
 * Multiplies two intervals.
 */
export const mulInterval = (a: Interval, b: Interval): Interval => {
  const p1 = a.min * b.min;
  const p2 = a.min * b.max;
  const p3 = a.max * b.min;
  const p4 = a.max * b.max;
  return {
    min: Math.min(p1, p2, p3, p4),
    max: Math.max(p1, p2, p3, p4),
  };
};

/**
 * Divides two intervals. Handles division by intervals containing zero.
 */
export const divInterval = (a: Interval, b: Interval): Interval => {
  // If divisor contains zero, return infinite interval to signal uncertainty
  if (b.min <= VAL_ZERO && b.max >= VAL_ZERO) {
    return {
      min: -Infinity,
      max: Infinity,
    };
  }
  const invB = {
    min: VAL_ONE / b.max,
    max: VAL_ONE / b.min,
  };
  return mulInterval(a, invB);
};

/**
 * Raises an interval to an integer power.
 * Uses parity rules for exact bounds.
 */
export const powInterval = (a: Interval, n: number): Interval => {
  if (n === VAL_ZERO) {
    return {
      min: VAL_ONE,
      max: VAL_ONE,
    };
  }

  // Handle fractional powers by converting to sqrt if n = 0.5
  const rootExponent = 0.5;
  if (n === rootExponent) {
    return sqrtInterval(a);
  }

  if (n % 2 !== VAL_ZERO) {
    // Odd power: preserves order
    return {
      min: Math.pow(a.min, n),
      max: Math.pow(a.max, n),
    };
  } else {
    // Even power: bounds depend on position relative to zero
    if (a.min >= VAL_ZERO) {
      return {
        min: Math.pow(a.min, n),
        max: Math.pow(a.max, n),
      };
    } else if (a.max <= VAL_ZERO) {
      return {
        min: Math.pow(a.max, n),
        max: Math.pow(a.min, n),
      };
    } else {
      return {
        min: VAL_ZERO,
        max: Math.max(Math.pow(a.min, n), Math.pow(a.max, n)),
      };
    }
  }
};

/**
 * Square root of an interval.
 * Supports manual selection of negative branch if needed.
 */
export const sqrtInterval = (a: Interval, negativeBranch: boolean = false): Interval => {
  const minClamped = Math.max(VAL_ZERO, a.min);
  const maxClamped = Math.max(VAL_ZERO, a.max);
  const sMin = Math.sqrt(minClamped);
  const sMax = Math.sqrt(maxClamped);

  if (negativeBranch) {
    return {
      min: -sMax,
      max: -sMin,
    };
  }
  return {
    min: sMin,
    max: sMax,
  };
};
