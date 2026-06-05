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
    duration: 0.35, // Premium, extremely responsive duration
    bounce: 0.2,   // Light organic bounce
  },
  TRANSITION_DURATION_MS: 350, // Central 350ms animation constant
} as const;

export const THEME_GLASS = {
  PANEL: 'backdrop-blur-md bg-[#110f22]/90 border border-white/10 shadow-2xl shadow-black/40 rounded-2xl',
  CARD: 'backdrop-blur-sm bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200 ease-in-out shadow-md rounded-xl',
  SHADOW_AMBIENT: 'shadow-[0_0_15px_rgba(99,102,241,0.2)]',
  SOURCE: 'shadow-[0_0_25px_rgba(99,102,241,0.5)] border-indigo-400/50 bg-indigo-950/80 text-indigo-100 font-semibold cursor-pointer',
  TARGET: 'shadow-[0_0_25px_rgba(16,185,129,0.5)] border-emerald-400/50 bg-emerald-950/80 cursor-pointer text-emerald-100 animate-pulse font-semibold',
  STATIC: 'border-zinc-800/80 bg-zinc-900/90 text-zinc-500 shadow-none font-normal opacity-100 cursor-default',
  CARD_CANDIDATE: 'border-white/10 bg-neutral-950/90 text-white/90 cursor-pointer',
  CARD_CANDIDATE_SCAN: 'border-sky-400/30 bg-sky-500/10 text-sky-100 shadow-[0_0_15px_rgba(56,189,248,0.1)] cursor-pointer',
  CARD_HOVER: 'border-indigo-400/40 bg-neutral-900/90 text-white font-medium shadow-md shadow-indigo-500/5 cursor-pointer',
  TREE_BG: 'bg-[#0b0a18] border border-white/5 rounded-2xl shadow-inner w-full',
} as const;
