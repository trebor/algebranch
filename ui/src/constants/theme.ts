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

  // --- Settings modal: setting row + toggle switch (#67) ---
  SETTING_ROW: 'flex items-start justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5',
  TOGGLE_TRACK: 'w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none border border-white/5 focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0',
  TOGGLE_TRACK_ON: 'bg-indigo-600 border-indigo-400/20',
  TOGGLE_TRACK_OFF: 'bg-white/10',
  TOGGLE_KNOB: 'w-4 h-4 bg-white rounded-full transition-transform absolute left-1 top-1',


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

  // --- Unified tooltip card (workspaces, tabs, library, history) ---
  TOOLTIP_EYEBROW: 'text-[10px] text-indigo-400 font-bold tracking-wider uppercase select-none',
  TOOLTIP_TITLE: 'text-xs font-bold text-white break-words',
  TOOLTIP_DESC: 'text-[11px] text-zinc-300 leading-snug',
  TOOLTIP_EQUATION: 'text-base sm:text-lg font-semibold text-indigo-100',
  TOOLTIP_EQ_SEP: 'font-mono text-indigo-400 select-none',
  TOOLTIP_RAW_EQ: 'font-mono text-xs text-indigo-300 break-words',

  TIMELINE_BADGE_ACTIVE: 'bg-indigo-600 border-indigo-400 text-white scale-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]',
  TIMELINE_BADGE_DEFAULT: 'bg-neutral-900 border-white/20 text-white/55 group-hover:border-indigo-400/50 group-hover:text-indigo-300',
  TIMELINE_CARD_ACTIVE: 'border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.15)]',
  TIMELINE_CARD_DEFAULT: 'border-white/5 bg-neutral-900/60 hover:bg-neutral-900/90 hover:border-white/10',

  // --- Onboarding / Tour specific ---
  BUTTON_SUCCESS: 'bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl active:scale-95 transition-all duration-150 cursor-pointer shadow-md shadow-emerald-600/20 border border-emerald-400/20',
  BUTTON_DANGER_FILL: 'bg-rose-600 hover:bg-rose-500 text-white rounded-xl active:scale-95 transition-all duration-150 cursor-pointer shadow-md shadow-rose-600/20 border border-rose-500/20',
  BUTTON_WARNING_FILL: 'bg-amber-600 hover:bg-amber-500 text-white rounded-xl active:scale-95 transition-all duration-150 cursor-pointer shadow-md shadow-amber-600/20 border border-amber-500/20',
  COACH_CARD: 'w-full p-4 rounded-2xl backdrop-blur-xl bg-[#110f22]/95 border border-indigo-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col gap-3',

  // --- Page / Main Canvas specific ---
  HEADER_BUTTON: 'flex items-center gap-1.5 p-2 sm:px-3.5 sm:py-1.5 rounded-full border border-white/10 text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 hover:border-indigo-500/35 cursor-pointer shadow-md transition-all duration-300 relative group',
  EDGE_HANDLE: 'w-full h-full flex items-center justify-center rounded-full border border-white/10 bg-neutral-900/60 backdrop-blur-md text-white/50 hover:text-indigo-300 hover:bg-indigo-600/20 hover:border-indigo-500/50 shadow-lg shadow-black/40 transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95',
  TOAST_ALERT: 'flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/25 bg-neutral-900/80 backdrop-blur-md text-xs text-indigo-300 font-semibold select-none shadow-lg shadow-black/20 animate-[fadeIn_0.2s_ease-out]',
  TOAST_LOADING: 'flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-neutral-900/60 backdrop-blur-md text-xs text-indigo-300 font-semibold select-none shadow-lg shadow-black/20 animate-[fadeIn_0.2s_ease-out]',
  SPINNER: 'animate-spin rounded-full border-indigo-500/20 border-t-indigo-400 shrink-0',
  ICON_BUTTON: 'p-2 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer shadow-md',
  ICON_BUTTON_DANGER: 'p-2 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-red-500/10 text-white/40 hover:text-red-400 hover:border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md',
  EQUALS_SIGN: 'relative text-[1.2em] font-light font-mono text-indigo-400 select-none px-[0.6em] py-[0.2em] bg-indigo-500/5 border border-indigo-500/10 rounded-[0.4em] shadow-inner shadow-black transition-all',
  PREVIEW_EQUALS_ACTIVE: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  PREVIEW_EQUALS_INACTIVE: 'text-zinc-600 border-zinc-500/10 bg-zinc-500/5',
  BANNER_DANGER: 'mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 max-w-xs text-center break-all shadow-lg',

  // --- Math Elements specific ---
  MATH_NUMBER_ACTIVE: 'text-yellow-400/90',
  MATH_NUMBER_STATIC: 'text-zinc-500',
  MATH_VAR_ACTIVE: 'text-sky-300',
  MATH_VAR_STATIC: 'text-zinc-500',
  MATH_FN_ACTIVE: 'text-purple-300',
  MATH_FN_STATIC: 'text-zinc-500',
  MATH_FN_ROOT_ACTIVE: 'text-indigo-300',
  MATH_FN_ROOT_STATIC: 'text-zinc-600',
  MATH_OP_ACTIVE: 'text-indigo-400',
  MATH_OP_UNARY_ACTIVE: 'text-indigo-300/90',
  MATH_OP_STATIC: 'text-zinc-600',
  MATH_OP_MUTED_ACTIVE: 'text-white/40',
  MATH_OP_MUTED_STATIC: 'text-zinc-600',
  MATH_BORDER_ACTIVE: 'border-white/20',
  MATH_BORDER_STATIC: 'border-zinc-700/30',
  MATH_BORDER_FN_ACTIVE: 'border-white/30',
  MATH_BORDER_FN_STATIC: 'border-zinc-800',

  // --- EquationNode Interactive Actions & glows ---
  TARGET_GLOW: 'bg-emerald-400/20 blur-md rounded-lg -z-10 animate-pulse',
  MINI_TOOLBAR: 'bg-neutral-900 border border-white/10 rounded-[1em] px-[0.6em] py-[0.2em] shadow-lg text-[0.55em] whitespace-nowrap',
  MINI_TOOLBAR_BUTTON: 'p-[0.1em] hover:bg-white/10 text-indigo-400 hover:text-indigo-300 rounded-[1em] transition-colors flex items-center gap-[0.2em] cursor-pointer',
  HANDLE_DISTRIBUTE: 'bg-purple-600 hover:bg-purple-500 text-white animate-pulse',
  HANDLE_IDENTITY: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  HANDLE_SIMPLIFY: 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-inner',
  PING_DISTRIBUTE: 'bg-purple-500/40',
  PING_IDENTITY: 'bg-indigo-500/40',
  PING_SIMPLIFY: 'bg-amber-400/40',
  HANDLE_SUBSTITUTE: 'bg-teal-500 hover:bg-teal-400 text-white',
  PING_SUBSTITUTE: 'bg-teal-400/40',

  // --- Substitution (#3): facts strip + history-tree badge ---
  FACT_CHIP: 'flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300/90 text-[10px] font-semibold select-none shrink-0 whitespace-nowrap',
  FACT_CHIP_ICON: 'flex items-center justify-center h-4 w-4 rounded-full bg-teal-500/80 text-white shrink-0',
  FACT_CHIP_SOURCE: 'text-teal-300/50 font-medium',
  TREE_NODE_BADGE_SUBSTITUTE: 'bg-teal-600 border-teal-400 text-teal-50',
  SUB_COUNT_BADGE: 'bg-neutral-950 border-teal-400 text-teal-300',

  // --- Domain restrictions (#63): history-tree badge + Step Details row ---
  // Amber "caveat" treatment so an assumed ≠0 restriction can't slip by unseen.
  TREE_NODE_BADGE_RESTRICTION: 'bg-amber-600 border-amber-400 text-amber-50',
  TOOLTIP_ASSUMPTION: 'flex items-center gap-1.5 text-[11px] font-semibold leading-snug text-amber-300 rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-1',
  TOOLTIP_ASSUMPTION_ICON: 'shrink-0 text-amber-400',

  // --- Unified Stacks & Chooser Design Tokens ---
  STACK_BADGE_SIMPLIFY: 'bg-neutral-950 border-amber-400 text-amber-400',
  STACK_BADGE_DISTRIBUTE: 'bg-neutral-950 border-purple-400 text-purple-400',
  STACK_BADGE_IDENTITY: 'bg-neutral-950 border-indigo-400 text-indigo-400',
  STACK_BADGE_SUBSTITUTE: 'bg-neutral-950 border-teal-400 text-teal-300',

  CHOOSER_OPTION_SIMPLIFY: 'font-mono text-xs text-amber-300',
  CHOOSER_OPTION_DISTRIBUTE: 'font-mono text-xs text-purple-300',
  CHOOSER_OPTION_IDENTITY: 'font-mono text-xs text-indigo-300',
  CHOOSER_OPTION_SUBSTITUTE: 'font-mono text-xs text-teal-300',

  // --- RadialMenu specific ---
  RADIAL_CENTER: 'w-14 h-14 rounded-full bg-indigo-600/30 border-2 border-indigo-400/50 backdrop-blur-xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.4)] pointer-events-auto cursor-pointer z-10',
  RADIAL_PETAL: 'w-12 h-12 rounded-full backdrop-blur-xl bg-neutral-900/80 border border-white/15 shadow-lg shadow-black/40 flex items-center justify-center pointer-events-auto transition-colors',
  RADIAL_PETAL_HOVER: 'cursor-pointer hover:bg-white/10 hover:border-white/30 hover:scale-110 active:scale-95',
  RADIAL_PETAL_LOCKED: 'cursor-default',
  RADIAL_INPUT_PANEL: 'flex items-center gap-2 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-xl px-3 py-2 shadow-2xl shadow-black/60',
  SPINNER_BOX: 'relative flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-lg px-2 py-1',
  SPINNER_BTN: 'w-6 h-6 rounded-md hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer',
  FIELD_INPUT: 'bg-neutral-900 border border-white/10 text-white placeholder-white/30 focus:outline-none transition-all font-mono rounded-lg',
  BUTTON_PRIMARY_SM: 'relative px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none',
  ALERT_DANGER_SM: 'text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 max-w-xs text-center',
  TEXT_BUTTON_MUTED: 'text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer',

  // --- Graphing specific ---
  GRAPH_AXIS: 'stroke-white/40',
  GRAPH_GRID_LINE: 'stroke-white/25',
  GRAPH_TICK_LINE: 'stroke-white/15',
  GRAPH_GUIDE_LINE: 'stroke-white/15',
  GRAPH_TICK_TEXT: 'fill-white/40 text-[10px] font-mono select-none',
  GRAPH_CURVE_LHS: 'stroke-indigo-400',
  GRAPH_CURVE_RHS: 'stroke-amber-400',
  GRAPH_SWATCH_LHS: 'bg-indigo-400',
  GRAPH_SWATCH_RHS: 'bg-amber-400',
  GRAPH_INTERSECTION_LINE: 'stroke-white/25',
  GRAPH_INTERSECTION_DOT: 'fill-emerald-400 stroke-emerald-950',
  GRAPH_LEGEND_CHIP: 'text-xs font-mono px-2.5 py-1 rounded-lg border bg-neutral-950/80 border-white/10 select-none',
  PANEL_TAB_ACTIVE: 'text-indigo-300 border-b-2 border-indigo-500 font-semibold text-xs transition-all',
  PANEL_TAB_IDLE: 'text-white/40 hover:text-white/70 text-xs transition-all border-b-2 border-transparent',
  GRAPH_TOOLTIP: 'absolute z-10 pointer-events-none flex flex-col gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-950/90 border border-white/10 backdrop-blur-md text-[10px] font-mono shadow-xl text-white/95 leading-none',
  GRAPH_TOOLTIP_HEADER: 'flex items-center gap-1.5 text-white/50 border-b border-white/5 pb-1 mb-1 font-bold',
  GRAPH_TOOLTIP_ROW_ACTIVE: 'flex items-center gap-1.5 text-white font-bold opacity-100 scale-[1.02] origin-left transition-all duration-150',
  GRAPH_TOOLTIP_ROW_INACTIVE: 'flex items-center gap-1.5 text-white/40 opacity-35 scale-95 origin-left transition-all duration-150',
  GRAPH_TOOLTIP_ROW_DEFAULT: 'flex items-center gap-1.5 text-white/90 transition-all duration-150',
} as const;
