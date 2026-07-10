// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

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
  TRANSITION_DURATION_MS: 500, // Node-slide (FLIP) duration — slower so the motion reads clearly (#234)
} as const;

export const THEME_GLASS = {
  PANEL: 'backdrop-blur-md bg-[#110f22]/90 border border-white/10 shadow-2xl shadow-black/40 rounded-2xl',
  CARD: 'backdrop-blur-sm bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200 ease-in-out shadow-md rounded-xl',
  SHADOW_AMBIENT: 'shadow-[0_0_15px_rgba(99,102,241,0.2)]',
  SOURCE: 'shadow-[0_0_25px_rgba(99,102,241,0.5)] border-indigo-400/50 bg-indigo-950/80 text-indigo-100 font-semibold cursor-pointer',
  TARGET: 'shadow-[0_0_25px_rgba(16,185,129,0.5)] border-emerald-400/50 bg-emerald-950/80 cursor-pointer text-emerald-100 animate-pulse font-semibold',
  STATIC: 'border-zinc-800/80 bg-zinc-900/90 text-zinc-500 shadow-none font-normal opacity-100 cursor-default',
  CARD_CANDIDATE: 'border-white/10 bg-neutral-950/90 text-white/90 cursor-pointer',
  // Visible keyboard-focus indicator for an actionable equation term (#231, WCAG
  // 2.4.7). focus-visible only, so mouse users never see it; a bright ring +
  // dark offset reads clearly over every node state (candidate/source/target).
  NODE_FOCUS_RING: 'outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:z-30',
  // Read-view cursor (#270): the active stop in the aria-activedescendant tree never
  // holds DOM focus (the tree container does), so focus-visible can't show it — this
  // is an always-on ring marking where the reading cursor sits.
  EXPLORE_CURSOR: 'ring-2 ring-sky-300 ring-offset-2 ring-offset-neutral-950 rounded-[0.2em] z-10',
  // Skip-link group (#257, #272): the whole set is visually hidden until any
  // link inside takes keyboard focus (focus-within), at which point the entire
  // stack surfaces top-left as a vertical list. Revealing the group — not just
  // the one focused link — keeps the set of jump targets discoverable at a
  // glance; pinning each link individually made the second overwrite the first
  // in place, so the affordance was easy to miss (#272). WCAG 2.4.1 (Bypass
  // Blocks).
  SKIP_LINK_NAV: 'sr-only focus-within:not-sr-only focus-within:fixed focus-within:top-4 focus-within:left-4 focus-within:z-[100] focus-within:flex focus-within:flex-col focus-within:items-start focus-within:gap-2',
  // A single skip link inside SKIP_LINK_NAV. Bright indigo fill + light text so
  // it stands out sharply against the app's near-black background (dark-on-dark
  // would be near-invisible), with a clear focus ring for the WCAG 2.4.7
  // indicator on the link that currently holds focus.
  SKIP_LINK: 'px-5 py-3 rounded-xl bg-indigo-600 text-base font-bold text-white shadow-2xl shadow-indigo-600/40 outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-neutral-950',
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
  TEXT_MUTED: 'text-white/55',
  TEXT_MUTED_EXTRA: 'text-white/50',
  TEXT_MUTED_LIGHT: 'text-white/60',
  TEXT_MUTED_BRIGHT: 'text-white/75',

  // Buttons
  BUTTON_PRIMARY: 'bg-indigo-600/95 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/10 border border-indigo-400/20 active:scale-95 transition-all duration-150 cursor-pointer',
  BUTTON_SECONDARY: 'bg-neutral-900 border border-white/10 hover:bg-neutral-800 hover:border-white/20 text-white rounded-xl active:scale-95 transition-all duration-150 cursor-pointer',
  BUTTON_SECONDARY_ACCENT: 'bg-indigo-900/40 hover:bg-indigo-800/50 border border-indigo-500/30 hover:border-indigo-400/40 text-indigo-200 hover:text-white rounded-xl active:scale-95 transition-all duration-150 cursor-pointer',
  BUTTON_SECONDARY_MUTED: 'bg-neutral-950 border border-white/5 rounded-xl text-white/40 transition-all duration-150 cursor-not-allowed',
  BUTTON_DANGER: 'bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all duration-150 cursor-pointer',

  // --- Settings modal: setting row + toggle switch (#67) ---
  SETTING_ROW: 'flex items-start justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5',
  TOGGLE_TRACK: 'w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none border border-white/5 focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0',
  TOGGLE_TRACK_ON: 'bg-indigo-600 border-indigo-400/20',
  TOGGLE_TRACK_OFF: 'bg-white/10',
  TOGGLE_KNOB: 'w-4 h-4 bg-white rounded-full transition-transform absolute left-1 top-1',

  // Stacked variant of SETTING_ROW: label/description on top, a full-width
  // control beneath. Used where a control (e.g. the segmented text-size picker,
  // #239) needs the row's full width rather than sitting to the right.
  SETTING_ROW_STACKED: 'flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5',

  // Segmented radio group (e.g. the text-size control, #239). Layout-neutral:
  // the call site adds `w-full` and `flex-1` buttons for a full-width row.
  SEGMENT_GROUP: 'flex rounded-xl border border-white/10 bg-neutral-950/60 p-0.5 gap-0.5',
  SEGMENT_BTN: 'px-2.5 py-1 rounded-lg text-xs font-semibold text-center transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
  SEGMENT_BTN_ACTIVE: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20',
  SEGMENT_BTN_IDLE: 'text-white/55 hover:text-white hover:bg-white/5',


  // Controls & Popovers
  FIELD_SELECT: 'bg-neutral-950/80 border border-white/5 hover:border-white/10 text-indigo-100 hover:text-white focus:outline-none focus:border-indigo-500/80 transition-all duration-150 font-mono cursor-pointer rounded-xl',
  OVERLAY_BG: 'bg-[#16142a] border border-white/10 rounded-xl shadow-2xl',
  OVERLAY_MOBILE: 'bg-[#110f22]/98 backdrop-blur-xl',
  
  // Cookie Consent Banner
  LINK: 'text-indigo-400 hover:text-indigo-300 transition-colors underline',
  BANNER_TITLE: 'text-sm font-semibold text-white',
  BANNER_TEXT: 'text-xs text-white/70 leading-relaxed',
  
  // General Typography Colors
  TEXT_HEADING: 'text-white',
  TEXT_BODY: 'text-zinc-300',
  TEXT_ACCENT: 'text-indigo-400 hover:text-indigo-300 transition-colors',
  
  // List items & groups
  LIST_ITEM_ACTIVE: 'text-indigo-300 bg-indigo-600/5 font-semibold',
  LIST_ITEM_HOVER: 'hover:bg-indigo-600/20 transition-colors',
  ACTIVE_BADGE: 'bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30',
  BADGE_MUTED: 'text-white/55 bg-white/5 rounded-full border border-white/5',
  // Keycap chip for the keyboard-shortcuts cheat-sheet (#126).
  SHORTCUT_KEYCAP: 'inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-lg border border-white/15 bg-white/5 text-white/90 text-xs font-semibold shadow-sm select-none',
  // Compact keycap for inline hotkey hints inside tooltips (HotkeyHint, #239).
  SHORTCUT_KEYCAP_SM: 'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-md border border-white/15 bg-white/5 text-white/90 text-xs font-semibold shadow-sm select-none',
  ACCENT_PLAY: 'p-1.5 rounded-lg bg-white/0 group-hover:bg-indigo-600/20 text-white/35 group-hover:text-indigo-400 border border-transparent group-hover:border-indigo-500/30 transform group-hover:scale-105 transition-all duration-200',
  
  // Library specific
  CATEGORY_HEADER: 'bg-neutral-950/60 border border-white/5 rounded-xl text-indigo-300 hover:text-indigo-200 hover:border-white/10 hover:bg-neutral-900/20 transition-all select-none cursor-pointer',
  CATEGORY_ITEM: 'rounded-xl border border-white/5 bg-neutral-950/80 hover:bg-neutral-900/90 text-white/55 hover:text-white/85 transition-all duration-200 cursor-pointer shadow-sm',

  // --- History & Tree Design Tokens (Issue #39) ---
  TREE_NODE_DEFAULT: 'border-white/5 hover:border-white/12 bg-neutral-950/80 hover:bg-neutral-900/90 text-white/55 hover:text-white/85 opacity-40 hover:opacity-100 shadow-md transition-all duration-300 cursor-pointer p-1.5',
  // Current (cursor) node — the focal point. Black fill like every other node
  // (#485: no indigo fill tint); it stands out purely via the brightest border,
  // an indigo glow, and a slight scale-up, so it reads even against on-path
  // ancestors that share its black ground.
  TREE_NODE_ACTIVE: 'border-indigo-400 text-indigo-100 bg-neutral-950/90 shadow-[0_0_16px_rgba(99,102,241,0.45)] scale-[1.02] transition-all duration-300 cursor-pointer p-1.5',
  // On the active derivation path (root → cursor) but not the current node (#305,
  // #485): a black fill matching the default node, with a clear indigo border
  // (brightening on hover) that ties the working column together via the border
  // and connecting edge — not a fill tint. Deliberately weaker than
  // TREE_NODE_ACTIVE (no glow, no scale) so the cursor still stands out.
  TREE_NODE_ON_PATH: 'border-indigo-400/55 hover:border-indigo-400/90 text-indigo-100/85 hover:text-white bg-neutral-950/80 hover:bg-neutral-900/90 shadow-md transition-all duration-300 cursor-pointer p-1.5',
  TREE_NODE_LOOP: 'border-fuchsia-500/80 text-fuchsia-300 bg-fuchsia-500/10 shadow-[0_0_15px_rgba(217,70,239,0.35)] scale-[1.02] transition-all duration-300 cursor-pointer p-1.5',
  
  LOOP_NODE_DEFAULT: 'border-fuchsia-500/40 hover:border-fuchsia-500/80 bg-fuchsia-950/60 hover:bg-fuchsia-950/80 text-fuchsia-400 hover:text-fuchsia-300 shadow-md shadow-fuchsia-950/20 transition-all duration-300 cursor-pointer',
  LOOP_NODE_ACTIVE: 'border-fuchsia-500 bg-fuchsia-500/20 shadow-[0_0_15px_rgba(217,70,239,0.45)] scale-[1.05] transition-all duration-300 cursor-pointer',
  
  TREE_NODE_BADGE_DEFAULT: 'bg-neutral-900 border-white/10 text-white/60',
  TREE_NODE_BADGE_ACTIVE: 'bg-indigo-600 border-indigo-400 text-indigo-100',
  TREE_NODE_BADGE_ON_PATH: 'bg-indigo-950 border-indigo-500/50 text-indigo-200',
  TREE_NODE_BADGE_LOOP: 'bg-fuchsia-600 border-fuchsia-400 text-fuchsia-100',
  LOOP_LINE_STROKE: 'rgba(217, 70, 239, 0.85)',
  // Tree connecting edges (#485). The active-path edge is a saturated, near-opaque
  // indigo (indigo-400) so the root→cursor links read clearly against the tree
  // ground; inactive branches stay a faint white. TREE_LINE_STROKE_PREVIEW is the
  // brighter indigo-300 used while previewing a full-derivation copy (#46).
  TREE_LINE_STROKE_ACTIVE: 'rgba(129, 140, 248, 0.9)',
  TREE_LINE_STROKE_INACTIVE: 'rgba(255, 255, 255, 0.12)',
  TREE_LINE_STROKE_PREVIEW: 'rgba(165, 180, 252, 0.95)',

  TOOLTIP_DETAILS: 'bg-neutral-950/98 shadow-[0_0_30px_rgba(99,102,241,0.25)] border border-indigo-500/20',

  // --- Unified tooltip card (workspaces, tabs, library, history) ---
  TOOLTIP_EYEBROW: 'text-xs text-indigo-400 font-bold tracking-wider select-none',
  TOOLTIP_TITLE: 'text-xs font-bold text-white break-words',
  TOOLTIP_DESC: 'text-xs text-zinc-300 leading-snug',
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
  TUTORIAL_BACKDROP: 'bg-black/60 backdrop-blur-sm',
  TUTORIAL_SWATCH: 'flex items-center gap-2 p-1.5 rounded-lg bg-neutral-950/95 border border-white/10 text-white/95',
  TUTORIAL_SWATCH_IMMOBILE: 'flex items-center gap-2 p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40 text-zinc-500',
  TUTORIAL_BADGE_SUCCESS: 'p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  TUTORIAL_BADGE_ACTIVE: 'p-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse',
  TUTORIAL_BADGE_MUTED: 'p-1 rounded-md bg-white/5 text-white/20 border border-white/10',
  TUTORIAL_RESUME_LABEL: 'text-[0.5rem] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 tracking-wider',
  TUTORIAL_CHAPTER_BUTTON: 'w-full text-left p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 active:scale-[0.99] transition-all flex items-center justify-between gap-3 cursor-pointer group',
  TUTORIAL_CELEBRATION_PANEL: 'shadow-[0_0_40px_rgba(52,211,153,0.2)] border border-emerald-500/20',
  TUTORIAL_CELEBRATION_TINT: 'p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_25px_rgba(52,211,153,0.35)]',
  TUTORIAL_SUCCESS_EYEBROW: 'text-xs font-bold tracking-wider text-emerald-400/80',
  TUTORIAL_WELCOME_EYEBROW: 'text-xs text-indigo-300/60 font-medium',

  // --- Page / Main Canvas specific ---
  HEADER_BUTTON: 'flex items-center gap-1.5 p-2 sm:px-3.5 sm:py-1.5 rounded-full border border-white/10 text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 hover:border-indigo-500/35 cursor-pointer shadow-md transition-all duration-300 relative group',
  OVERFLOW_TRIGGER: 'flex items-center justify-center p-2 rounded-full border border-white/10 text-white/80 hover:text-white bg-white/5 hover:bg-white/10 hover:border-indigo-500/35 cursor-pointer shadow-md transition-all duration-300 relative group',
  OVERFLOW_MENU: 'absolute right-0 top-full mt-1.5 z-50 w-44 p-1 rounded-xl bg-neutral-950/95 border border-indigo-500/30 backdrop-blur-md shadow-2xl flex flex-col gap-0.5 text-left',
  OVERFLOW_MENU_ITEM: 'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-white/70 hover:text-white hover:bg-indigo-600/20 transition-colors cursor-pointer select-none text-xs font-semibold',
  HEADER_ICON_ABOUT: 'text-indigo-400 group-hover:scale-110 transition-transform',
  HEADER_ICON_SETTINGS: 'text-indigo-400 group-hover:rotate-45 transition-transform',
  EDGE_HANDLE: 'w-full h-full flex items-center justify-center rounded-full border border-white/10 bg-neutral-900/60 backdrop-blur-md text-white/50 hover:text-indigo-300 hover:bg-indigo-600/20 hover:border-indigo-500/50 shadow-lg shadow-black/40 transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95',
  // Persistent peek tab that brings the chrome back from immersive mode (#252):
  // a thin, centered pill hugging the top/bottom edge, always reachable.
  PEEK_HANDLE: 'flex items-center justify-center w-16 h-5 rounded-full border border-white/10 bg-neutral-900/70 backdrop-blur-md text-white/50 hover:text-indigo-300 hover:bg-indigo-600/20 hover:border-indigo-500/50 shadow-lg shadow-black/40 transition-all duration-300 cursor-pointer active:scale-95',
  TOAST_ALERT: 'flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/25 bg-neutral-900/80 backdrop-blur-md text-xs text-indigo-300 font-semibold select-none shadow-lg shadow-black/20 animate-[fadeIn_0.2s_ease-out]',
  TOAST_LOADING: 'flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-neutral-900/60 backdrop-blur-md text-xs text-indigo-300 font-semibold select-none shadow-lg shadow-black/20 animate-[fadeIn_0.2s_ease-out]',
  // Error toast (#481): a red-tinted variant for a chord that couldn't do its job
  // (e.g. a short link that failed to mint) — loud enough that the miss is seen.
  TOAST_ERROR: 'flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-neutral-900/80 backdrop-blur-md text-xs text-red-300 font-semibold select-none shadow-lg shadow-black/20 animate-[fadeIn_0.2s_ease-out]',
  SPINNER: 'animate-spin rounded-full border-indigo-500/20 border-t-indigo-400 shrink-0',
  ICON_BUTTON: 'p-2 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-white/10 text-white/55 hover:text-white transition-all cursor-pointer shadow-md',
  ICON_BUTTON_DANGER: 'p-2 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-red-500/10 text-white/55 hover:text-red-400 hover:border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md',
  // Icon button in its "on" state (e.g. the graph toggle while the graph is open)
  ICON_BUTTON_ACTIVE: 'p-2 rounded-xl border border-indigo-400/30 bg-indigo-600/90 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-md',
  // Floating footer for the onboarding coach card / welcome modal: a slightly
  // more opaque tint than the card so scrolling content stays legible as it
  // passes under the pinned controls. Under the new black step-content card,
  // this blueish footer uses a subtle top border to create a clean divider.
  TOUR_FOOTER: 'bg-[#110f22]/95 backdrop-blur-md border-t border-white/5',
  // Onboarding walkthrough coach card container: a dark neutral background
  // to match the chapter-menu cards and welcome modal, highlighting the
  // content area.
  TOUR_CARD: 'w-full shrink-0 border-t border-white/10 bg-neutral-950/95 rounded-b-2xl max-lg:rounded-b-none z-40 overflow-hidden flex flex-col max-h-[38dvh] sm:max-h-none shadow-lg',
  EQUALS_SIGN: 'relative text-[1.2em] font-light font-mono text-indigo-400 select-none px-[0.6em] py-[0.2em] bg-indigo-500/5 border border-indigo-500/10 rounded-[0.4em] shadow-inner shadow-black transition-all z-10',
  EQUALS_SIGN_INTERACTIVE: 'cursor-pointer hover:bg-indigo-500/15 hover:border-indigo-400/35 active:scale-95',
  EQUALS_BADGE: 'absolute -top-2 -right-2 w-5 h-5 rounded-full bg-indigo-600 border border-indigo-400 flex items-center justify-center text-xs leading-none text-white font-bold select-none cursor-pointer shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse z-20',
  RELATION_SELECT: 'w-14 h-8 appearance-none bg-indigo-500/5 hover:bg-indigo-500/15 border border-indigo-500/20 hover:border-indigo-400/35 focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-500/30 text-indigo-400 font-mono font-bold text-sm text-center rounded-lg cursor-pointer transition-all focus:outline-none pl-2.5 pr-5 shadow-inner shadow-black/40',
  RELATION_SELECT_CHEVRON: 'absolute right-1.5 pointer-events-none text-indigo-400/50 transition-colors',
  // Positioning is supplied at render time: the popover is portaled to <body>
  // with fixed coords (see page.tsx) so it escapes the overflow-clipping /
  // scaled equation ancestors that previously hid it behind content (#172).
  EQUALS_POPOVER: 'w-48 p-3 rounded-xl bg-neutral-950/95 border border-indigo-500/30 backdrop-blur-md shadow-2xl flex flex-col gap-1.5 text-left',
  EQUALS_POPOVER_TITLE: 'text-[0.5625rem] font-bold text-indigo-400 tracking-wider select-none',
  EQUALS_POPOVER_DESC: 'text-xs leading-snug text-white/70',
  EQUALS_POPOVER_BTN: 'mt-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[0.5625rem] font-bold rounded-lg self-end transition-all cursor-pointer shadow-md shadow-indigo-600/20 border border-indigo-400/20',
  // Drag-nudge coach card (#386): small non-modal popover anchored near a term the
  // user tried to *drag*, steering them into the two-tap move.
  DRAG_NUDGE_CARD: 'w-60 p-3 rounded-xl bg-neutral-950/95 border border-indigo-500/30 backdrop-blur-md shadow-2xl flex flex-col gap-2 text-left pointer-events-auto',
  DRAG_NUDGE_TITLE: 'text-[0.5625rem] font-bold text-indigo-400 tracking-wider select-none uppercase',
  DRAG_NUDGE_DESC: 'text-xs leading-snug text-white/70',
  DRAG_NUDGE_CHECK_ROW: 'flex items-center gap-2 cursor-pointer select-none text-[0.6875rem] text-white/50 hover:text-white/70 transition-colors',
  DRAG_NUDGE_CHECKBOX: 'w-3.5 h-3.5 accent-indigo-500 cursor-pointer',
  DRAG_NUDGE_CLOSE: 'absolute top-1.5 right-1.5 p-0.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors cursor-pointer',
  // Live preview of the picked-up subexpression inside the nudge card.
  DRAG_NUDGE_PREVIEW_ROW: 'flex items-center gap-2 flex-wrap',
  DRAG_NUDGE_PREVIEW_LABEL: 'text-[0.625rem] font-medium text-white/40 select-none shrink-0',
  DRAG_NUDGE_PREVIEW_BOX: 'px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-400/25 text-white/90 text-base leading-none max-w-full overflow-x-auto scrollbar-thin',
  // Copy-as-format menu (#46): popover offering Plain / LaTeX / Unicode export.
  COPY_MENU: 'z-50 w-44 p-1 rounded-xl bg-neutral-950/95 border border-indigo-500/30 backdrop-blur-md shadow-2xl flex flex-col gap-0.5 text-left',
  COPY_MENU_ITEM: 'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-indigo-600/20 transition-colors cursor-pointer select-none',
  COPY_MENU_ITEM_ICON: 'shrink-0 text-indigo-300/80',
  // Header naming the export scope (#46, option B): an eyebrow label over the
  // nicely-rendered destination expression, so it's clear what will be copied.
  COPY_MENU_HEADER: 'flex flex-col gap-0.5 px-2.5 pt-1.5 pb-2 mb-0.5 border-b border-white/10 select-none',
  COPY_MENU_HEADER_LABEL: 'text-[0.5625rem] font-bold tracking-wider text-indigo-400/80',
  COPY_MENU_HEADER_EXPR: 'block truncate text-xs text-indigo-50',
  // Typeset preview of the equation being copied (#243): the real
  // PreviewEquationNode render (lhs = rhs) replaces the flat unicode echo, so the
  // header reads as "a picture of which equation" rather than a fourth format.
  // Scrolls horizontally inside the fixed-width menu when the equation is wide.
  COPY_MENU_HEADER_PREVIEW: 'flex justify-center max-w-full overflow-x-auto scrollbar-thin',
  COPY_MENU_HEADER_PREVIEW_ROW: 'flex items-center gap-1.5 text-sm text-indigo-50 min-w-max',
  COPY_MENU_HEADER_PREVIEW_SEP: 'font-mono text-indigo-400/80 select-none',
  // Off-path node while an export-scope preview is active (#46): faded so the
  // root -> selected path reads as the slice being copied.
  COPY_PREVIEW_DIMMED: 'opacity-25 transition-opacity duration-200',

  // Copy split-button (#243): mirrors the Share pill — a primary segment that
  // copies the default (Unicode) format in one click, plus a caret that reveals
  // the Plain / Unicode / LaTeX menu and signals the dropdown. Two sizes:
  // `panel` (roomy derivation toolbar) and `tree` (compact, sits in the per-step
  // hover toolbar on a history card). The copied state tints the whole control.
  COPY_SPLIT_PANEL: 'inline-flex items-stretch rounded-lg border border-white/10 text-white transition-colors',
  COPY_SPLIT_PANEL_PRIMARY: 'flex items-center px-1.5 py-1.5 rounded-l-lg hover:bg-white/5 active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none',
  COPY_SPLIT_PANEL_DIVIDER: 'w-px self-stretch my-1 bg-white/10',
  COPY_SPLIT_PANEL_CARET: 'flex items-center px-1 rounded-r-lg text-white/55 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none',
  // The tree variant is a compact, centered split-button with no panel fill —
  // just two saturated glyphs and a thin separator, each segment lighting up on
  // hover — so it stays unobtrusive on the node yet clearly legible (#243).
  COPY_SPLIT_TREE: 'inline-flex items-center rounded-md text-indigo-100 transition-colors',
  COPY_SPLIT_TREE_PRIMARY: 'flex items-center p-1 rounded-l-md hover:bg-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none',
  COPY_SPLIT_TREE_DIVIDER: 'w-px self-stretch my-1 bg-white/10',
  COPY_SPLIT_TREE_CARET: 'flex items-center px-0.5 rounded-r-md text-indigo-100/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none',
  COPY_SPLIT_COPIED: 'text-emerald-400 hover:text-emerald-400 border-emerald-500/20 bg-emerald-500/10',

  // Share split-button (#241): a pill split into a primary segment (copies the
  // headline WORKSPACE link in one gesture) and a caret that reveals the scope
  // menu. `relative group` anchors the one-time hint pulse ring.
  SHARE_PILL: 'flex items-stretch rounded-full border border-white/10 bg-white/5 shadow-md transition-all duration-300 relative group',
  SHARE_PILL_PRIMARY: 'flex items-center gap-1.5 py-1.5 pl-3 pr-2.5 sm:pl-3.5 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 rounded-l-full transition-colors cursor-pointer',
  SHARE_PILL_DIVIDER: 'w-px self-stretch my-1.5 bg-white/15',
  SHARE_PILL_CARET: 'flex items-center px-1.5 sm:px-2 text-white/55 hover:text-white hover:bg-white/10 rounded-r-full transition-colors cursor-pointer',
  // One-time "you have something worth sending" pulse ring on the Share pill
  // (#241). animate-ping; only rendered when motion is allowed.
  SHARE_HINT_PULSE: 'pointer-events-none absolute -inset-0.5 rounded-full border border-indigo-400/60 animate-ping',
  // Share scope menu (#241): wider than COPY_MENU so each row can carry a
  // selling subtitle describing what the link restores.
  SHARE_MENU: 'absolute right-0 top-full mt-1.5 z-50 w-64 p-1 rounded-xl bg-neutral-950/95 border border-indigo-500/30 backdrop-blur-md shadow-2xl flex flex-col gap-0.5 text-left',
  SHARE_MENU_ITEM: 'flex items-start gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-white/70 hover:text-white hover:bg-indigo-600/20 transition-colors cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white/70',
  SHARE_MENU_ITEM_TITLE: 'text-xs font-semibold',
  SHARE_MENU_ITEM_DESC: 'text-[0.625rem] leading-snug text-white/45',
  // Link-size characterization (#439): a qualitative band ("Tiny/Compact/Large")
  // advising whether the link pastes everywhere, with the exact char count muted
  // beside it. OK = safe to share anywhere; WARN = large enough that some chat
  // apps may trim it.
  SHARE_SIZE_BADGE: 'inline-flex items-baseline gap-1 text-[0.625rem] leading-snug font-medium',
  SHARE_SIZE_BADGE_OK: 'text-emerald-300/80',
  SHARE_SIZE_BADGE_WARN: 'text-amber-300/90',
  SHARE_SIZE_BADGE_COUNT: 'text-white/35 font-normal tabular-nums',
  // Large-link advice (#405): a muted explanatory note rendered *inside* an offline
  // menu item when that item's own link lands in the WARN band, naming the truncation
  // risk and — where a smaller link exists below — nudging toward it. The amber tint
  // echoes the warn badge, but the sentence, not the color, carries the meaning.
  SHARE_MENU_ADVICE: 'mt-0.5 text-[0.625rem] leading-snug text-amber-200/80',
  // Thin separator between the primary short-link rows and the offline section (#481).
  SHARE_MENU_DIVIDER: 'h-px my-1 mx-1.5 bg-white/10',
  // Collapsed "Links that work offline" disclosure toggle (#481): muted so it sits
  // quietly below the recommended short links; the chevron flags its expand state.
  SHARE_MENU_SECTION_TOGGLE:
    'flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[0.6875rem] font-medium text-white/40 hover:text-white/75 hover:bg-white/5 transition-colors cursor-pointer select-none',
  // The same toggle promoted to the primary choice when the network is down (#481):
  // the short-link rows are disabled, so this becomes the highlighted next step.
  SHARE_MENU_SECTION_TOGGLE_ACTIVE:
    'flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[0.6875rem] font-semibold text-indigo-200 bg-indigo-600/15 hover:bg-indigo-600/25 transition-colors cursor-pointer select-none',
  // Offline heads-up under the header (#481): names why the short links are grayed
  // and points at the offline choices below, so the fallback is a conscious pick.
  SHARE_MENU_OFFLINE_NOTE: 'px-2.5 pb-1.5 text-[0.625rem] leading-snug text-amber-200/80',
  // Footer trust line (#482): quietly reassures that shared work stays private and
  // links out to the privacy policy for the full zero-knowledge explanation.
  SHARE_MENU_PRIVACY_NOTE:
    'flex items-center gap-1.5 px-2.5 pt-1 text-[0.625rem] leading-snug text-white/50',
  SHARE_MENU_PRIVACY_LINK: 'text-indigo-300 hover:text-indigo-200 underline transition-colors',

  // Workspace switcher (#247): on short/landscape viewports the horizontal tab
  // strip collapses into this pill + popover anchored top-left of the expression
  // space. The trigger names the active workspace (Layers glyph + name + caret)
  // so it reads as a breadcrumb; the popover folds in the full list (each row
  // keeping rename/close) plus the New-workspace row that replaces the `+`.
  WORKSPACE_SWITCHER_TRIGGER: 'inline-flex items-center gap-1.5 max-w-[60vw] pl-2.5 pr-2 py-1.5 rounded-xl border border-indigo-500/30 bg-white/10 text-white text-xs font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.25)] backdrop-blur-sm hover:bg-white/15 transition-all cursor-pointer select-none',
  WORKSPACE_SWITCHER_TRIGGER_NAME: 'truncate tracking-wide',
  WORKSPACE_SWITCHER_MENU: 'absolute left-0 top-full mt-1.5 z-50 w-64 max-w-[80vw] p-1 rounded-xl bg-neutral-950/95 border border-indigo-500/30 backdrop-blur-md shadow-2xl flex flex-col gap-0.5 text-left',
  WORKSPACE_SWITCHER_LIST: 'flex flex-col gap-0.5 max-h-[40dvh] overflow-y-auto scrollbar-thin',
  WORKSPACE_SWITCHER_ROW: 'group flex items-center gap-1 rounded-lg pr-1 transition-colors',
  WORKSPACE_SWITCHER_ROW_ACTIVE: 'bg-indigo-600/15',
  WORKSPACE_SWITCHER_ROW_INACTIVE: 'hover:bg-white/5',
  WORKSPACE_SWITCHER_ROW_MAIN: 'flex-1 flex items-center gap-2 min-w-0 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium cursor-pointer select-none',
  WORKSPACE_SWITCHER_ROW_NAME: 'truncate',
  WORKSPACE_SWITCHER_ROW_ACTIONS: 'flex items-center gap-0.5 shrink-0',
  WORKSPACE_SWITCHER_ROW_BTN: 'p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer',
  WORKSPACE_SWITCHER_EDIT_INPUT: 'flex-1 min-w-0 mx-1 my-0.5 bg-neutral-900 border border-indigo-500/50 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500',
  WORKSPACE_SWITCHER_NEW: 'flex items-center gap-2 w-full px-2.5 py-2 mt-0.5 border-t border-white/10 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-indigo-600/20 transition-colors cursor-pointer select-none',

  EQUALS_MINI_PETAL_SWAP: 'text-amber-400 border-amber-500/20',
  EQUALS_MINI_PETAL_POWER: 'text-teal-400 border-teal-500/20',
  EQUALS_MINI_PETAL_ADD: 'text-indigo-400 border-indigo-500/20',
  EQUALS_MINI_PETAL_SUB: 'text-violet-400 border-violet-500/20',
  EQUALS_MINI_PETAL_MUL: 'text-rose-400 border-rose-500/20',
  EQUALS_MINI_PETAL_DIV: 'text-pink-400 border-pink-500/20',
  EQUALS_MINI_PETAL_ROOT: 'text-emerald-400 border-emerald-500/20',
  EQUALS_MINI_CENTER: 'w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center text-[0.5625rem] font-bold text-indigo-300 shadow-md',
  EQUALS_MINI_PETAL_BASE: 'w-3.5 h-3.5 rounded-full bg-neutral-900 border border-white/10 text-[0.40625rem] font-bold flex items-center justify-center shadow-sm',
  PREVIEW_EQUALS_ACTIVE: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  PREVIEW_EQUALS_INACTIVE: 'text-zinc-600 border-zinc-500/10 bg-zinc-500/5',
  BANNER_DANGER: 'mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 max-w-xs text-center break-all shadow-lg',

  // --- Math Elements specific ---
  MATH_NUMBER_ACTIVE: 'text-yellow-400/90',
  MATH_NUMBER_STATIC: 'text-zinc-500',
  MATH_VAR_ACTIVE: 'text-sky-300',
  MATH_VAR_STATIC: 'text-zinc-500',
  // Lowered, shrunk subscript for underscore-named symbols (#113): v_0 → v₀.
  MATH_SUBSCRIPT: 'text-[0.65em] align-baseline relative top-[0.28em] ml-[0.03em] opacity-90',
  MATH_FN_ACTIVE: 'text-purple-300',
  MATH_FN_STATIC: 'text-zinc-500',
  MATH_FN_ROOT_ACTIVE: 'text-indigo-300',
  MATH_FN_ROOT_STATIC: 'text-zinc-600',
  MATH_OP_ACTIVE: 'text-indigo-400',
  MATH_OP_UNARY_ACTIVE: 'text-indigo-300/90',
  MATH_OP_STATIC: 'text-zinc-600',
  MATH_OP_MUTED_ACTIVE: 'text-white/55',
  MATH_OP_MUTED_STATIC: 'text-zinc-600',
  MATH_BORDER_ACTIVE: 'border-white/20',
  MATH_BORDER_STATIC: 'border-zinc-700/30',
  MATH_BORDER_FN_ACTIVE: 'border-white/30',
  MATH_BORDER_FN_STATIC: 'border-zinc-800',

  // --- EquationNode Interactive Actions & glows ---
  TARGET_GLOW: 'bg-emerald-400/20 blur-md rounded-lg -z-10 animate-pulse',
  MINI_TOOLBAR: 'bg-neutral-900 border border-white/10 rounded-[1em] px-[0.6em] py-[0.2em] shadow-lg text-[0.55em] whitespace-nowrap',
  MINI_TOOLBAR_BUTTON: 'p-[0.1em] hover:bg-white/10 text-indigo-400 hover:text-indigo-300 rounded-[1em] transition-colors flex items-center gap-[0.2em] cursor-pointer',
  // #427 five-handle taxonomy — Simplify (amber soloist) · Expand + Factor (the
  // green "structure" family) · Rewrite + Substitute (the blue-violet
  // "equivalence" family). Expand/Factor are the product↔sum inverse pair:
  // neighbouring emerald/teal hues say "these belong together", while the
  // mirrored Unfold/Fold icons carry the direction. Teal moved off Substitute
  // (now violet) so it can mark Factor as emerald's deeper sibling.
  HANDLE_SIMPLIFY: 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-inner',
  HANDLE_EXPAND: 'bg-emerald-500 hover:bg-emerald-400 text-white',
  HANDLE_FACTOR: 'bg-teal-600 hover:bg-teal-500 text-white',
  HANDLE_IDENTITY: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  HANDLE_SUBSTITUTE: 'bg-violet-600 hover:bg-violet-500 text-white',
  // Legacy 'distribute' family, repointed to Expand/emerald so history nodes
  // serialized before #427 still resolve an Expand-coloured tree badge.
  HANDLE_DISTRIBUTE: 'bg-emerald-500 hover:bg-emerald-400 text-white',
  PING_SIMPLIFY: 'bg-amber-400/40',
  PING_EXPAND: 'bg-emerald-500/40',
  PING_FACTOR: 'bg-teal-500/40',
  PING_IDENTITY: 'bg-indigo-500/40',
  PING_SUBSTITUTE: 'bg-violet-400/40',
  PING_DISTRIBUTE: 'bg-emerald-500/40',

  // --- Live reduce-region highlight (#423 part 2) ---
  // While a handle/option is hovered or its menu is open, the live equation's
  // affected subtree lights up in the stack's accent colour, threading the option
  // row → live region → dimmed preview into one colour story. A ring + soft outer
  // glow (no layout cost) outlines the region root; the accents match the handle
  // colours (amber/emerald/teal/indigo/violet) so the hovered handle and the lit
  // region read as the same family.
  REDUCE_REGION_SIMPLIFY: 'ring-2 ring-amber-400/70 shadow-[0_0_16px_rgba(251,191,36,0.4)]',
  REDUCE_REGION_EXPAND: 'ring-2 ring-emerald-400/70 shadow-[0_0_16px_rgba(16,185,129,0.4)]',
  REDUCE_REGION_FACTOR: 'ring-2 ring-teal-400/70 shadow-[0_0_16px_rgba(20,184,166,0.4)]',
  REDUCE_REGION_IDENTITY: 'ring-2 ring-indigo-400/70 shadow-[0_0_16px_rgba(99,102,241,0.4)]',
  REDUCE_REGION_SUBSTITUTE: 'ring-2 ring-violet-400/70 shadow-[0_0_16px_rgba(139,92,246,0.4)]',

  // --- Substitution (#3): facts strip + history-tree badge ---
  // Violet, matching the Substitute handle (#427) so the fact chips, the count
  // badge, and the tree badge all read as one substitution family — teal now
  // belongs to Factor.
  FACT_CHIP: 'flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300/90 text-xs font-semibold select-none shrink-0 whitespace-nowrap',
  FACT_CHIP_ICON: 'flex items-center justify-center h-4 w-4 rounded-full bg-violet-500/80 text-white shrink-0',
  FACT_CHIP_SOURCE: 'text-violet-300/50 font-medium',
  TREE_NODE_BADGE_SUBSTITUTE: 'bg-violet-600 border-violet-400 text-violet-50',
  SUB_COUNT_BADGE: 'bg-neutral-950 border-violet-400 text-violet-300',

  // --- Domain restrictions (#63): history-tree badge + Step Details row ---
  // Amber "caveat" treatment so an assumed ≠0 restriction can't slip by unseen.
  TREE_NODE_BADGE_RESTRICTION: 'bg-amber-600 border-amber-400 text-amber-50',
  TOOLTIP_ASSUMPTION: 'flex items-center gap-1.5 text-xs font-semibold leading-snug text-amber-300 rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-1',
  TOOLTIP_ASSUMPTION_ICON: 'shrink-0 text-amber-400',
  // Standing "given x ≠ 0" caveat under the main equation (#486): the accumulated
  // restriction set active on the current branch, shown persistently (not just on
  // the introducing step's edge) so a working answer never hides its conditions.
  ACTIVE_RESTRICTION_CAVEAT: 'flex items-center gap-1.5 text-xs font-semibold leading-snug text-amber-300 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1',
  ACTIVE_RESTRICTION_CAVEAT_ICON: 'shrink-0 text-amber-400',
  TREE_NODE_BADGE_CONTRADICTION: 'bg-red-600 border-red-400 text-red-50',
  TREE_NODE_BADGE_IDENTITY: 'bg-emerald-600 border-emerald-400 text-emerald-50',
  // Standing terminal-state caveat under the main equation (#487): whenever the
  // engine freezes the whole tree, this one banner states why — the single halt
  // surface, so at most one ever shows (÷0, contradiction, and identity are
  // mutually exclusive by construction). A sibling of ACTIVE_RESTRICTION_CAVEAT
  // (they stack when both apply), keyed to the same red / emerald families as the
  // matching tree state badges (UNDEFINED_TREE_BADGE, TREE_NODE_BADGE_*) so the
  // surfaces read as one system. The red "dead-end" family covers both ÷0 and a
  // contradiction (distinguished by icon, not colour); emerald marks the identity.
  TERMINAL_STATE_CAVEAT: 'flex items-center gap-1.5 text-xs font-semibold leading-snug rounded-md px-2 py-1 border',
  TERMINAL_STATE_CAVEAT_DEADEND: 'text-red-200 border-red-400/30 bg-red-500/10',
  TERMINAL_STATE_CAVEAT_IDENTITY: 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10',
  TERMINAL_STATE_CAVEAT_ICON_DEADEND: 'shrink-0 text-red-400',
  TERMINAL_STATE_CAVEAT_ICON_IDENTITY: 'shrink-0 text-emerald-400',

  // --- Term slot (#491): the empty dashed chip standing for "any term/side" ---
  // The generic placeholder in operation previews (( )^n, √( ), the reciprocal
  // hops): an empty dashed rounded socket, echoing the app's drag-target look so
  // it reads as "whichever term lands here". Sized in em so it scales with the
  // surrounding math text.
  TERM_SLOT: 'inline-block w-[1.15em] h-[1.05em] rounded border border-dashed border-white/30 align-middle',
  TERM_SLOT_FRACTION_BAR: 'border-t border-white/60 pt-0.5 px-0.5',

  // --- Undefined (÷0) warning (#416): dead-end marker on division-by-zero subtrees ---
  // Two surfaces share one warning: an inline warning-triangle handle on the
  // offending subtree, and a state badge on the history-tree node. Red, warning-
  // shaped: a dead end, not a caution or an offered move.
  // Inline handle: fills the (guaranteed-free) action-handle slot; a bare glowing
  // triangle so the warning shape reads, not a colored action-handle disk.
  UNDEFINED_HANDLE: 'flex items-center justify-center text-red-400 cursor-help drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]',
  // History-tree corner badge — mirrors the contradiction badge so the terminal-
  // status cluster stays visually consistent.
  UNDEFINED_TREE_BADGE: 'bg-red-600 border-red-400 text-red-50',
  // Shared tooltip chrome. No max-width on the shell: the title stays on one line
  // (whitespace-nowrap) and defines the tooltip's natural width, so "zero" never
  // wraps; the body clamps its own width so longer prose still wraps under it.
  UNDEFINED_TOOLTIP: 'flex items-start gap-2 text-left',
  UNDEFINED_TOOLTIP_ICON: 'shrink-0 text-red-400 mt-0.5',
  UNDEFINED_TOOLTIP_TITLE: 'font-semibold text-red-300 whitespace-nowrap',
  UNDEFINED_TOOLTIP_BODY: 'text-white/70 max-w-[15rem]',
  // Inline-tooltip preview chrome: the offending `/0` sub-expression, boxed so it
  // reads as a rendered term rather than as part of the prose.
  UNDEFINED_TOOLTIP_PREVIEW: 'self-start rounded-md bg-white/5 px-2 py-1 text-white text-[1.15em] leading-none',

  // --- Unified Stacks & Chooser Design Tokens ---
  CHOOSER_OPTION_SIMPLIFY: 'font-mono text-xs text-amber-300',
  CHOOSER_OPTION_EXPAND: 'font-mono text-xs text-emerald-300',
  CHOOSER_OPTION_FACTOR: 'font-mono text-xs text-teal-300',
  CHOOSER_OPTION_DISTRIBUTE: 'font-mono text-xs text-emerald-300',
  CHOOSER_OPTION_IDENTITY: 'font-mono text-xs text-indigo-300',
  CHOOSER_OPTION_SUBSTITUTE: 'font-mono text-xs text-violet-300',

  // Resting button chrome for chooser rows (#369): a subtle filled, bordered,
  // rounded surface so each option reads as a pressable control before any
  // hover — not a heading. Hover/focus brightens the fill and border.
  CHOOSER_OPTION_ROW:
    'rounded-md bg-white/[0.06] border border-white/10 hover:bg-indigo-600/25 hover:border-indigo-400/50 focus-visible:bg-indigo-600/25 focus-visible:border-indigo-400/60 transition-colors',
  // Trailing "apply" arrow: muted at rest, brightens with its row.
  CHOOSER_OPTION_ARROW: 'text-white/35 group-hover:text-indigo-200 group-focus-visible:text-indigo-200 transition-colors',

  // --- RadialMenu specific ---
  RADIAL_CENTER: 'w-14 h-14 rounded-full bg-indigo-600/30 border-2 border-indigo-400/50 backdrop-blur-xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.4)] pointer-events-auto cursor-pointer select-none z-10',
  RADIAL_PETAL: 'w-12 h-12 rounded-full backdrop-blur-xl bg-neutral-900/80 border border-white/15 shadow-lg shadow-black/40 flex items-center justify-center pointer-events-auto select-none transition-colors',
  RADIAL_PETAL_HOVER: 'cursor-pointer hover:bg-white/10 hover:border-white/30 hover:scale-110 active:scale-95',
  RADIAL_PETAL_LOCKED: 'cursor-default',
  RADIAL_INPUT_PANEL: 'flex items-center gap-2 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-xl px-3 py-2 shadow-2xl shadow-black/60',
  SPINNER_BOX: 'relative flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-lg px-2 py-1',
  SPINNER_BTN: 'w-6 h-6 rounded-md hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer',
  FIELD_INPUT: 'bg-neutral-900 border border-white/10 text-white placeholder-white/30 focus:outline-none transition-all font-mono rounded-lg',
  // Symbol-palette insert button (e.g. the imaginary unit ⅈ, #105): a small
  // keycap-style button that splices a glyph into the focused expression field.
  SYMBOL_INSERT_BTN: 'inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 text-white/90 shadow-sm select-none active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed',
  BUTTON_PRIMARY_SM: 'relative px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none',
  ALERT_DANGER_SM: 'text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 max-w-xs text-center',
  TEXT_BUTTON_MUTED: 'text-xs text-white/55 hover:text-white/70 transition-colors cursor-pointer',

  // --- Graphing specific ---
  GRAPH_AXIS: 'stroke-white/40',
  GRAPH_GRID_LINE: 'stroke-white/25',
  GRAPH_TICK_LINE: 'stroke-white/15',
  GRAPH_GUIDE_LINE: 'stroke-white/15',
  GRAPH_TICK_TEXT: 'fill-white/55 text-xs font-mono select-none',
  GRAPH_CURVE_LHS: 'stroke-indigo-400',
  GRAPH_CURVE_RHS: 'stroke-amber-400',
  GRAPH_SWATCH_LHS: 'bg-indigo-400',
  GRAPH_SWATCH_RHS: 'bg-amber-400',
  GRAPH_INTERSECTION_LINE: 'stroke-white/25',
  GRAPH_INTERSECTION_DOT: 'fill-emerald-400 stroke-emerald-950',
  GRAPH_LEGEND_CHIP: 'text-xs font-mono px-2.5 py-1 rounded-lg border bg-neutral-950/80 border-white/10 select-none',
  PANEL_TAB_ACTIVE: 'text-indigo-300 border-b-2 border-indigo-500 font-semibold text-xs transition-all',
  PANEL_TAB_IDLE: 'text-white/55 hover:text-white/70 text-xs transition-all border-b-2 border-transparent',
  GRAPH_TOOLTIP: 'absolute z-10 pointer-events-none flex flex-col gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-950/90 border border-white/10 backdrop-blur-md text-xs font-mono shadow-xl text-white/95 leading-none',
  GRAPH_TOOLTIP_HEADER: 'flex items-center gap-1.5 text-white/50 border-b border-white/5 pb-1 mb-1 font-bold',
  GRAPH_TOOLTIP_ROW_ACTIVE: 'flex items-center gap-1.5 text-white font-bold opacity-100 scale-[1.02] origin-left transition-all duration-150',
  GRAPH_TOOLTIP_ROW_INACTIVE: 'flex items-center gap-1.5 text-white/40 opacity-35 scale-95 origin-left transition-all duration-150',
  GRAPH_TOOLTIP_ROW_DEFAULT: 'flex items-center gap-1.5 text-white/90 transition-all duration-150',
} as const;

// --- Equation preview palettes (#335 image export) ---
// PreviewEquationNode reads its leaf colours from a palette (via context) so it can
// render legibly on the chosen export background. The DARK palette holds the exact
// in-app colours, so it is the default and nothing in the app changes; the LIGHT
// palette is used when exporting on a white or transparent background.
export interface EquationPreviewPalette {
  /** Numeric constants. */
  number: string;
  /** Variable / symbol glyphs. */
  variable: string;
  /** Operator symbols and radical strokes. */
  operator: string;
  /** Generic function names, e.g. log(. */
  fnName: string;
  /** Parenthesis strokes and function-call parens. */
  paren: string;
  /** Fraction vinculum border colour. */
  fractionBar: string;
  /** Radical vinculum border colour. */
  radicalBar: string;
  /** The relation symbol (=, <, …) drawn between the two sides. */
  relation: string;
}

export const EQUATION_PREVIEW_PALETTE_DARK: EquationPreviewPalette = {
  number: 'text-yellow-500/80',
  variable: 'text-sky-400/80',
  operator: 'text-indigo-400/60',
  fnName: 'text-purple-400/60',
  paren: 'text-white/20',
  fractionBar: 'border-white/10',
  radicalBar: 'border-white/15',
  relation: 'text-indigo-300',
};

/**
 * Recede palette for the carried-over (unchanged) nodes of a transform preview
 * (#423). Every glyph collapses to a faint neutral grey so the changed/new nodes —
 * which keep the vivid semantic dark palette — read as the figure and the carried
 * context reads as ground. Tuned on the dark glass theme via `npm run shoot`; on a
 * quadratic-formula-sized preview the grey majority must recede without turning to
 * mud, so the change stays legible even at PREVIEW_MIN_SCALE.
 */
export const EQUATION_PREVIEW_PALETTE_DIM: EquationPreviewPalette = {
  number: 'text-white/30',
  variable: 'text-white/30',
  operator: 'text-white/25',
  fnName: 'text-white/30',
  paren: 'text-white/15',
  fractionBar: 'border-white/15',
  radicalBar: 'border-white/15',
  relation: 'text-white/30',
};

export const EQUATION_PREVIEW_PALETTE_LIGHT: EquationPreviewPalette = {
  number: 'text-amber-600',
  variable: 'text-sky-700',
  operator: 'text-indigo-600',
  fnName: 'text-purple-600',
  paren: 'text-slate-400',
  fractionBar: 'border-slate-500',
  radicalBar: 'border-slate-500',
  relation: 'text-indigo-600',
};
