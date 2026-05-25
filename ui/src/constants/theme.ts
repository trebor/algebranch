/**
 * Premium UI Theme Constants
 * Enforces strict typing, UPPER_CASE constants, and 2-space indentation.
 */

export const THEME_TRANSITIONS = {
  DEFAULT: 'transition-all duration-300 ease-in-out',
  FAST: 'transition-all duration-150 ease-in-out',
  SLOW: 'transition-all duration-500 ease-in-out',
} as const;

export const THEME_ANIMATIONS = {
  LAYOUT_TRANSITION: {
    type: 'spring',
    duration: 2.0, // Stretched to 2.0s for visual debugging, reduce later
    bounce: 0.2,   // Light organic bounce
  },
  TRANSITION_DURATION_MS: 2000, // Central 2-second animation constant
} as const;

export const THEME_GLASS = {
  PANEL: 'backdrop-blur-md bg-white/5 border border-white/10 shadow-2xl shadow-black/40 rounded-2xl',
  CARD: 'backdrop-blur-sm bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200 ease-in-out shadow-md rounded-xl',
  GLOW: 'shadow-[0_0_15px_rgba(99,102,241,0.2)]',
  GLOW_ACTIVE: 'shadow-[0_0_25px_rgba(99,102,241,0.5)] border-indigo-400/50',
  GLOW_VALID: 'shadow-[0_0_25px_rgba(16,185,129,0.5)] border-emerald-400/50',
} as const;

export const MATH_PRESETS = [
  {
    id: 'QUADRATIC_SOLVE',
    label: 'Quadratic Equation Solution',
    equation: 'x^2 - 4 = 0',
  },
  {
    id: 'LINEAR_EQUATION',
    label: 'Basic Linear Equation',
    equation: '2x + 4 = 10',
  },
  {
    id: 'IDEAL_GAS_LAW',
    label: 'Ideal Gas Law',
    equation: 'P * V = n * R * T',
  },
  {
    id: 'ENERGY_MASS',
    label: 'Einstein Mass Energy',
    equation: 'E = m * c^2',
  },
  {
    id: 'PYTHAGOREAN_THEOREM',
    label: 'Pythagorean Theorem',
    equation: 'a^2 + b^2 = c^2',
  },
] as const;
