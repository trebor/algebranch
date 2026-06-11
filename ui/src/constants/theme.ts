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
  TREE_BG: 'bg-[#1c1a35] border border-white/5 rounded-2xl shadow-inner w-full',
  // Tutorial annotation circle marking the next element to click. Deliberately
  // outside the app's rounded-rect/hue vocabulary. Pair with an -inset-* class
  // to control how far it overshoots the marked element.
  ONBOARDING_CIRCLE: 'absolute rounded-full border-2 border-white shadow-[0_0_12px_rgba(255,255,255,0.6)] pointer-events-none z-20 animate-[onboarding-circle-breathe_1.8s_ease-in-out_infinite]',

  // --- Chrome Design Tokens (Issue #39) ---
  PANEL_HEADER: 'border-b border-white/10 pb-3',
  PANEL_BORDER: 'border-white/10',
  PANEL_BORDER_SUBTLE: 'border-white/5',
  
  // Text & Colors
  TEXT_MUTED: 'text-white/40',
  TEXT_MUTED_EXTRA: 'text-white/30',
  TEXT_MUTED_LIGHT: 'text-white/50',
  TEXT_MUTED_BRIGHT: 'text-white/70',

  // Buttons
  BUTTON_PRIMARY: 'bg-indigo-600/95 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/10 border border-indigo-400/20 active:scale-95 transition-all duration-150 cursor-pointer',
  BUTTON_SECONDARY: 'bg-neutral-900 border border-white/10 hover:bg-neutral-800 hover:border-white/20 text-white rounded-xl active:scale-95 transition-all duration-150 cursor-pointer',
  BUTTON_SECONDARY_MUTED: 'bg-neutral-950 border border-white/5 rounded-xl text-white/30 transition-all duration-150 cursor-not-allowed',
  BUTTON_DANGER: 'bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all duration-150 cursor-pointer',
  
  // Controls & Popovers
  FIELD_SELECT: 'bg-neutral-950/80 border border-white/5 hover:border-white/10 text-indigo-100 hover:text-white focus:outline-none focus:border-indigo-500/80 transition-all duration-150 font-mono cursor-pointer rounded-xl',
  OVERLAY_BG: 'bg-[#16142a] border border-white/10 rounded-xl shadow-2xl',
  OVERLAY_MOBILE: 'bg-[#110f22]/98 backdrop-blur-xl',
  
  // List items & groups
  LIST_ITEM_ACTIVE: 'text-indigo-300 bg-indigo-600/5 font-semibold',
  LIST_ITEM_HOVER: 'hover:bg-indigo-600/20 transition-colors',
  ACTIVE_BADGE: 'bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30',
  BADGE_MUTED: 'text-white/40 bg-white/5 rounded-full border border-white/5',
  ACCENT_PLAY: 'p-1.5 rounded-lg bg-white/0 group-hover:bg-indigo-600/20 text-white/20 group-hover:text-indigo-400 border border-transparent group-hover:border-indigo-500/30 transform group-hover:scale-105 transition-all duration-200',
  
  // Library specific
  CATEGORY_HEADER: 'bg-neutral-950/60 border border-white/5 rounded-xl text-indigo-300 hover:text-indigo-200 hover:border-white/10 hover:bg-neutral-900/20 transition-all select-none cursor-pointer',
  CATEGORY_ITEM: 'rounded-xl border border-white/5 bg-neutral-950/80 hover:bg-neutral-900/90 text-white/55 hover:text-white/85 transition-all duration-200 cursor-pointer shadow-sm',

  // --- History & Tree Design Tokens (Issue #39) ---
  TREE_NODE_DEFAULT: 'border-white/5 hover:border-white/12 bg-neutral-950/80 hover:bg-neutral-900/90 text-white/55 hover:text-white/85 shadow-md transition-all duration-300 cursor-pointer p-1.5',
  TREE_NODE_ACTIVE: 'border-indigo-400/85 text-indigo-300 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.25)] scale-[1.02] transition-all duration-300 cursor-pointer p-1.5',
  TREE_NODE_LOOP: 'border-fuchsia-500/80 text-fuchsia-300 bg-fuchsia-500/10 shadow-[0_0_15px_rgba(217,70,239,0.35)] scale-[1.02] transition-all duration-300 cursor-pointer p-1.5',
  
  LOOP_NODE_DEFAULT: 'border-fuchsia-500/40 hover:border-fuchsia-500/80 bg-fuchsia-950/60 hover:bg-fuchsia-950/80 text-fuchsia-400 hover:text-fuchsia-300 shadow-md shadow-fuchsia-950/20 transition-all duration-300 cursor-pointer',
  LOOP_NODE_ACTIVE: 'border-fuchsia-500 bg-fuchsia-500/20 shadow-[0_0_15px_rgba(217,70,239,0.45)] scale-[1.05] transition-all duration-300 cursor-pointer',
  
  TREE_NODE_BADGE_DEFAULT: 'bg-neutral-900 border-white/10 text-white/60',
  TREE_NODE_BADGE_ACTIVE: 'bg-indigo-600 border-indigo-400 text-indigo-100',
  TREE_NODE_BADGE_LOOP: 'bg-fuchsia-600 border-fuchsia-400 text-fuchsia-100',

  TOOLTIP_DETAILS: 'bg-neutral-950/98 shadow-[0_0_30px_rgba(99,102,241,0.25)] border border-indigo-500/20',

  TIMELINE_BADGE_ACTIVE: 'bg-indigo-600 border-indigo-400 text-white scale-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]',
  TIMELINE_BADGE_DEFAULT: 'bg-neutral-900 border-white/20 text-white/55 group-hover:border-indigo-400/50 group-hover:text-indigo-300',
  TIMELINE_CARD_ACTIVE: 'border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.15)]',
  TIMELINE_CARD_DEFAULT: 'border-white/5 bg-neutral-900/60 hover:bg-neutral-900/90 hover:border-white/10',
} as const;
