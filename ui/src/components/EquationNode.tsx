// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Tooltip } from './Tooltip';
import type * as math from 'mathjs';
import {
  sourcePathAtom,
  hoverPathAtom,
  targetPathsAtom,
  pushEquationAtom,
  currentEquationAtom,
  candidatePathsAtom,
  hoverReducePathAtom,
  hoverReduceIndexAtom,
  filteredReduciblePathsAtom,
  substitutionPathsAtom,
  toggleRootSignAtom,
  onboardingChapterIdAtom,
  onboardingHighlightPathAtom,
  onboardingTargetPathAtom,
  onboardingReduceHandleAtom,
  onboardingSubstitutionAtom,
  isTreeAnimatingAtom,
  ReducibleActionInfo,
} from '../store/equation';
import { OPERATOR_DISPLAY, RELATION_DISPLAY, splitSubscript, symbolHintFor, isImaginaryUnit } from '../constants/mathSymbols';
import { THEME_GLASS } from '../constants/theme';
import { useOptionalRovingTabindex } from '../hooks/useRovingTabindex';
import { Equation, getNodeByPath, getFunctionName, getChildren, formatNumber, nodeToSpeech } from 'math-engine-client';
import type { SubstitutionOption } from 'math-engine';
import { describeTransposition, describeReduction, describeSubstitution, describeCollapse } from 'math-engine';
import { ArrowLeftRight, Zap, Split, RefreshCw, Replace, TriangleAlert } from 'lucide-react';
import { trackEvent } from '../utils/analytics';
import { PreviewEquationNode } from './PreviewEquationNode';
import { useMathScale } from '../hooks/useMathScale';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { shouldPulseHandle } from './handlePulse';
import {
  hasTallRootIndex,
  radicalPath,
  RADICAL_DEFAULT_CROOK_Y,
  RADICAL_CROOK_FRACTION,
  INDEX_INSET_EM,
  RADICAL_SVG_WIDTH_EM,
  RADICAL_ARM_X_AT_CROOK,
  INDEX_ARM_RIGHT_MARGIN_EM,
} from './radicalGeometry';

interface UnifiedStackOption {
  id: string;
  label: string;
  subLabel?: string;
  equation: Equation;
  originalOption: ReducibleActionInfo | SubstitutionOption;
  /** Domain restrictions the option assumes (#63), e.g. ['x ≠ 0'], shown as a
   *  ⚠ caveat on the handle/menu so the student sees it before applying (#59). */
  assumptions?: readonly string[];
  onApply: () => void;
}

// Floor below which an equation preview stops shrinking and scrolls instead, so a
// pathologically wide equation never becomes unreadably small. Matches the global
// useMathScale floor (0.4) so a wide preview — e.g. the quadratic formula as a
// substitution — scales down to fit the popup rather than clamping early and
// spilling off the right edge.
const PREVIEW_MIN_SCALE = 0.4;

const renderEquationPreviewRow = (eq: Equation, muted: boolean) => (
  <div className="flex items-center justify-center gap-1.5 flex-nowrap text-[1.3em]">
    <PreviewEquationNode path="lhs" customEquation={eq} />
    <span className={`text-[1.3em] font-mono px-0.5 select-none ${muted ? 'text-transparent' : 'text-indigo-300'}`}>{RELATION_DISPLAY[eq.relation ?? '='] ?? '='}</span>
    <PreviewEquationNode path="rhs" customEquation={eq} />
  </div>
);

/**
 * Shared container for every equation preview popup (single/stacked handle menu,
 * move target, candidate term). Scales its content to fit the container width
 * with one uniform factor (via the workspace auto-scaler `useMathScale`); once it
 * would shrink past PREVIEW_MIN_SCALE it clamps and scrolls horizontally instead
 * of spilling out of the popup body. Optional `sizers` reserve the widest of
 * several stacked options so a hover-swapped preview never reflows. extraBuffer=0
 * keeps the auto-height container from ratcheting the scale down on resize.
 */
const ScaledEquationFit: React.FC<{
  measureEq?: Equation | null;
  className?: string;
  sizers?: React.ReactNode;
  children: React.ReactNode;
}> = ({ measureEq = null, className = 'w-full max-w-full', sizers, children }) => {
  const { containerRef, contentRef } = useMathScale(measureEq, [], 0, PREVIEW_MIN_SCALE, 1);
  return (
    <div ref={containerRef} className={`${className} overflow-x-auto scrollbar-thin py-0.5`}>
      <div ref={contentRef} className="grid place-items-center min-w-max mx-auto">
        {sizers}
        <div className="col-start-1 row-start-1 flex items-center justify-center">{children}</div>
      </div>
    </div>
  );
};

const STACK_CONFIG = {
  reduce: {
    singularLabel: 'Simplify',
    pluralLabel: 'simplifications',
    icon: Zap,
    handleClass: THEME_GLASS.HANDLE_SIMPLIFY,
    pingClass: THEME_GLASS.PING_SIMPLIFY,
    badgeClass: THEME_GLASS.STACK_BADGE_SIMPLIFY,
    iconClass: 'text-neutral-950 fill-neutral-950 stroke-[2.5]',
  },
  distribute: {
    singularLabel: 'Distribute',
    pluralLabel: 'distributions',
    icon: Split,
    handleClass: THEME_GLASS.HANDLE_DISTRIBUTE,
    pingClass: THEME_GLASS.PING_DISTRIBUTE,
    badgeClass: THEME_GLASS.STACK_BADGE_DISTRIBUTE,
    iconClass: 'text-white stroke-[2.5]',
  },
  identity: {
    singularLabel: 'Apply Identity',
    pluralLabel: 'identities',
    icon: ArrowLeftRight,
    handleClass: THEME_GLASS.HANDLE_IDENTITY,
    pingClass: THEME_GLASS.PING_IDENTITY,
    badgeClass: THEME_GLASS.STACK_BADGE_IDENTITY,
    iconClass: 'text-white stroke-[2.5]',
  },
  substitute: {
    singularLabel: 'Substitute',
    pluralLabel: 'substitutions',
    icon: Replace,
    handleClass: THEME_GLASS.HANDLE_SUBSTITUTE,
    pingClass: THEME_GLASS.PING_SUBSTITUTE,
    badgeClass: THEME_GLASS.STACK_BADGE_SUBSTITUTE,
    iconClass: 'text-white stroke-[2.5]',
  },
} as const;

// Hover behavior for the multi-option interaction menu (a self-contained popover,
// deliberately NOT a Tooltip, so the global single-active-tooltip mechanism can't
// steal it closed while the cursor traverses from the handle to the menu).
const MENU_HOVER_CLOSE_GRACE_MS = 280; // grace period bridging handle <-> menu hover
const MENU_ANCHOR_GAP_PX = 8;          // gap between the handle and the menu card
const MENU_HALF_WIDTH_PX = 180;        // approx half-width, for horizontal edge clamping

const LeftParenSVG: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg
    viewBox="0 0 8 100"
    preserveAspectRatio="none"
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M 6,3 C 1,25 1,75 6,97"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
    />
  </svg>
);

const RightParenSVG: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg
    viewBox="0 0 8 100"
    preserveAspectRatio="none"
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M 2,3 C 7,25 7,75 2,97"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
    />
  </svg>
);

interface EquationNodeProps {
  readonly path: string;
  readonly inExponent?: boolean;
  /**
   * Minimum top padding (a CSS length string) the node's box must reserve, forced
   * by a parent row so every sibling operand shares one top-boundary offset (#30).
   * Without it, a handle-bearing operand reserves a fixed button band up top while
   * its bare siblings reserve only nodePy, dropping its text below theirs. The row
   * hands every operand the row-wide max so their content centers line up. May mix
   * units (rem for handle bands, em for bare padding), so it is combined via CSS
   * max() rather than numeric Math.max (#121).
   */
  readonly minPaddingTop?: string;
  /**
   * Suppress the fixed-rem top reserve a handle-bearing node normally adds. Used
   * when the node is rendered as a radical index (#198): the index is a tiny
   * 0.55em annotation in the crook, and the fixed-rem reserve would dwarf it and
   * shove it onto the radical arm. With the reserve off, the index sits at its
   * natural content height (so a tall fraction/radical index isn't forced into a
   * fixed slot either) and any handle badge floats over the top instead.
   */
  readonly suppressHandleReserve?: boolean;
  /**
   * Wrap the node in a full-width, horizontally centered click target to intercept
   * gutter clicks under a fraction bar (#313).
   */
  readonly fillRowHit?: boolean;
}

/**
 * Helper to check if a node at path can toggle its root sign.
 */
const canToggleRoot = (eq: math.MathNode | unknown): boolean => {
  const node = eq as math.MathNode;
  if (!node) return false;

  if (node.type === 'FunctionNode') {
    const fnNode = node as math.FunctionNode;
    const nameStr = getFunctionName(fnNode);
    return nameStr === 'sqrt';
  }

  if (node.type === 'OperatorNode' && (node as math.OperatorNode).op === '-' && (node as math.OperatorNode).isUnary()) {
    const child = (node as math.OperatorNode).args[0];
    if (child && child.type === 'FunctionNode') {
      const childFn = child as math.FunctionNode;
      const nameStr = getFunctionName(childFn);
      return nameStr === 'sqrt';
    }
  }

  return false;
};

/**
 * Debug aid (#201): append `?crookdebug` to the URL to overlay the index target box
 * (the region above the crook where a tall index should nestle) and the crook line,
 * so the geometry can be eyeballed against the rendered index. Off in normal use.
 */
const DEBUG_CROOK =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('crookdebug');

/**
 * Layout design tokens for node dimensions.
 *
 * Two unit systems are at play (#121):
 * - The **handle band** (btnSize/btnGap/btnTop/btnRight/textGap) is rendered at a
 *   FIXED visual size, anchored to HANDLE_REM rem rather than the node's font. The
 *   workspace auto-scaler (useMathScale, 0.4–2.8×) sizes the math text, but handles
 *   no longer scale with it — so huge expressions don't get huge handles, nested
 *   handles stay compact, and every handle reads at one consistent size. These
 *   numbers are ratios of HANDLE_REM (the toolbar sets font-size: HANDLE_REM rem,
 *   so the existing em/% internals resolve against that fixed anchor).
 * - The **node's own text padding** (nodePx/nodePy) stays in em so a node's breathing
 *   room scales with its (auto-scaled) glyphs.
 */
const HANDLE_REM = 1.2;
const MATH_LAYOUT = {
  // Normal layouts
  normal: {
    btnSize: 0.8,
    btnGap: 0.05,
    btnTop: 0.22,
    btnRight: 0.32,
    nodePx: 0.35,
    nodePy: 0.18,
    textGap: 0.07,
  },
  // Exponent layouts
  exponent: {
    btnSize: 0.55,
    btnGap: 0.05,
    btnTop: 0.14,
    btnRight: 0.2,
    nodePx: 0.2,
    nodePy: 0.12,
    textGap: 0.05,
  }
};

type MathLayout = typeof MATH_LAYOUT.normal;

/**
 * Top space a handle-bearing node must reserve so its toolbar floats clear of the
 * text. Fixed (rem) to match the fixed-size handle band, independent of the
 * expression's auto-scale. Returns a CSS length string.
 */
const handleReserve = (layout: MathLayout): string =>
  `${((layout.btnTop + layout.btnSize + layout.textGap) * HANDLE_REM).toFixed(4)}rem`;

/**
 * Largest of several CSS lengths. Used for baseline-alignment top padding (#30)
 * where the candidates may mix units (rem handle bands vs em bare padding), so a
 * numeric Math.max won't do — defer to CSS max() at layout time. Collapses to the
 * single value when they're all identical.
 */
const cssMax = (...lengths: string[]): string => {
  const unique = [...new Set(lengths)];
  return unique.length === 1 ? unique[0] : `max(${unique.join(', ')})`;
};


export const EquationNode: React.FC<EquationNodeProps> = ({
  path,
  inExponent = false,
  minPaddingTop = '0px',
  suppressHandleReserve = false,
  fillRowHit = false,
}) => {
  const [sourcePath, setSourcePath] = useAtom(sourcePathAtom);
  const [hoverPath, setHoverPath] = useAtom(hoverPathAtom);
  const [hoverReducePath, setHoverReducePath] = useAtom(hoverReducePathAtom);
  const [, setHoverReduceIndex] = useAtom(hoverReduceIndexAtom);
  const reduciblePaths = useAtomValue(filteredReduciblePathsAtom);
  const substitutionPaths = useAtomValue(substitutionPathsAtom);
  const targetPaths = useAtomValue(targetPathsAtom);
  const pushEquation = useSetAtom(pushEquationAtom);
  const currentEq = useAtomValue(currentEquationAtom);
  const candidatePaths = useAtomValue(candidatePathsAtom);
  const toggleRootSign = useSetAtom(toggleRootSignAtom);
  // Roving-tabindex controller for the expression composite widget (#257). Null
  // when rendered outside a provider (isolated tests / previews), in which case
  // the node falls back to the legacy single-Tab-stop-per-candidate behavior.
  const roving = useOptionalRovingTabindex();
  // Honor prefers-reduced-motion (#145): suppress the decorative handle pulse.
  const reducedMotion = useReducedMotion();
  // Suppress this node's hover tooltip while the tree is mid-slide (#234), so a
  // popover doesn't appear under the cursor while the term is still moving.
  const isTreeAnimating = useAtomValue(isTreeAnimatingAtom);
  const isOnboardingActive = !!useAtomValue(onboardingChapterIdAtom);
  const onboardingHighlightPath = useAtomValue(onboardingHighlightPathAtom);
  const onboardingTargetPath = useAtomValue(onboardingTargetPathAtom);
  const onboardingReduceHandle = useAtomValue(onboardingReduceHandleAtom);
  const onboardingSubstitution = useAtomValue(onboardingSubstitutionAtom);
  // Which option's equation preview the open menu is showing, keyed by stack type
  // so a stale hover from one stack never leaks into another.
  const [hoveredOption, setHoveredOption] = React.useState<{ type: 'reduce' | 'distribute' | 'identity' | 'substitute'; index: number } | null>(null);
  // The multi-option menu is a hover popover, not a Tooltip: openMenuType is the
  // stack whose menu is open, menuAnchor is its on-screen anchor, and a grace timer
  // bridges the hover gap between the handle and the menu.
  const [openMenuType, setOpenMenuType] = React.useState<'reduce' | 'distribute' | 'identity' | 'substitute' | null>(null);
  const [menuAnchor, setMenuAnchor] = React.useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
  const menuCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keyboard focus model for the multi-option menu (#257, PR D). A keyboard-opened
  // menu is a modal-style transient popover: focus moves to the first option and
  // arrow keys rove it; Escape / outside-click close it and return focus to the
  // handle. A hover-opened menu leaves focus alone — a pointer user is never yanked
  // in. menuOpenedViaKeyboardRef records which path opened it; menuTriggerElRef is
  // the handle to restore focus to; menuOptionRefs is the ordered option registry.
  const [menuActiveIndex, setMenuActiveIndex] = React.useState(0);
  const menuOpenedViaKeyboardRef = React.useRef(false);
  const menuTriggerElRef = React.useRef<HTMLElement | null>(null);
  const menuContainerRef = React.useRef<HTMLDivElement | null>(null);
  const menuOptionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const cancelMenuClose = React.useCallback(() => {
    if (menuCloseTimer.current) {
      clearTimeout(menuCloseTimer.current);
      menuCloseTimer.current = null;
    }
  }, []);
  const closeMenu = React.useCallback(() => {
    cancelMenuClose();
    setOpenMenuType(null);
    setHoveredOption(null);
    setHoverReducePath(null);
    setHoverReduceIndex(null);
  }, [cancelMenuClose, setHoverReducePath, setHoverReduceIndex]);
  // Leaving the handle or the menu schedules a close after a grace period; moving
  // onto the other one cancels it. This is the entire open/close model — no global
  // tooltip state involved, so nothing external can dismiss the menu mid-traversal.
  const scheduleMenuClose = React.useCallback(() => {
    cancelMenuClose();
    menuCloseTimer.current = setTimeout(closeMenu, MENU_HOVER_CLOSE_GRACE_MS);
  }, [cancelMenuClose, closeMenu]);
  React.useEffect(() => cancelMenuClose, [cancelMenuClose]);

  // Close the menu and hand focus back to the handle that opened it. The exit
  // path for Escape / outside-click — never a permanent trap (WCAG 2.1.2).
  const closeMenuAndRestoreFocus = React.useCallback(() => {
    const trigger = menuTriggerElRef.current;
    closeMenu();
    trigger?.focus();
  }, [closeMenu]);

  // Roving within the open menu. Reads the live focus position from the option
  // registry (so it's immune to stale state) and wraps at both ends.
  const moveMenuFocus = React.useCallback((dir: 'next' | 'prev' | 'first' | 'last') => {
    const els = menuOptionRefs.current.filter((el): el is HTMLButtonElement => !!el);
    if (els.length === 0) return;
    const cur = els.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (dir === 'first') next = 0;
    else if (dir === 'last') next = els.length - 1;
    else if (dir === 'next') next = cur < 0 ? 0 : (cur + 1) % els.length;
    else next = cur < 0 ? els.length - 1 : (cur - 1 + els.length) % els.length;
    els[next]?.focus();
    setMenuActiveIndex(next);
  }, []);

  const handleMenuKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault(); e.stopPropagation(); moveMenuFocus('next');
          break;
        case 'ArrowUp':
          e.preventDefault(); e.stopPropagation(); moveMenuFocus('prev');
          break;
        case 'Home':
          e.preventDefault(); e.stopPropagation(); moveMenuFocus('first');
          break;
        case 'End':
          e.preventDefault(); e.stopPropagation(); moveMenuFocus('last');
          break;
        case 'Tab':
          // Focus wraps within the open popover (modal-style transient menu, as
          // scoped in #257) — Escape / outside-click remain the clean exits.
          e.preventDefault(); e.stopPropagation();
          moveMenuFocus(e.shiftKey ? 'prev' : 'next');
          break;
        case 'Escape':
          e.preventDefault(); e.stopPropagation(); closeMenuAndRestoreFocus();
          break;
      }
    },
    [moveMenuFocus, closeMenuAndRestoreFocus],
  );

  // Keyboard-opened menus move focus to the first option once the portal commits;
  // hover-opened menus leave focus on the page (no yank for a pointer user).
  React.useEffect(() => {
    if (openMenuType && menuOpenedViaKeyboardRef.current) {
      menuOptionRefs.current[0]?.focus();
    }
  }, [openMenuType]);

  // Outside-click dismissal: a pointerdown anywhere outside the open menu and its
  // handle closes it, returning focus to the handle (matching Escape).
  React.useEffect(() => {
    if (!openMenuType) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        (menuTriggerElRef.current?.contains(target) ||
          menuContainerRef.current?.contains(target))
      ) {
        return;
      }
      closeMenuAndRestoreFocus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [openMenuType, closeMenuAndRestoreFocus]);

  // Open a multi-option handle's menu anchored to its button. Shared by hover
  // (onMouseEnter) and keyboard/click (Enter/Space) so the menu is reachable
  // without a pointer (#231).
  const openStackMenu = React.useCallback(
    (el: HTMLElement, type: 'reduce' | 'distribute' | 'identity' | 'substitute', viaKeyboard = false) => {
      cancelMenuClose();
      menuTriggerElRef.current = el;
      menuOpenedViaKeyboardRef.current = viaKeyboard;
      setMenuActiveIndex(0);
      const rect = el.getBoundingClientRect();
      const left = Math.max(
        MENU_HALF_WIDTH_PX + 8,
        Math.min(rect.left + rect.width / 2, window.innerWidth - MENU_HALF_WIDTH_PX - 8),
      );
      // Handle in the top half of the viewport => open the menu downward (and
      // vice-versa) so it always grows into the roomier half.
      const placement = rect.top + rect.height / 2 < window.innerHeight / 2 ? 'below' : 'above';
      setMenuAnchor({
        top: placement === 'below' ? rect.bottom + MENU_ANCHOR_GAP_PX : rect.top - MENU_ANCHOR_GAP_PX,
        left,
        placement,
      });
      setOpenMenuType(type);
      setHoveredOption(null);
      if (type !== 'substitute') {
        setHoverReducePath(path);
        setHoverReduceIndex(null);
      }
    },
    [cancelMenuClose, path, setHoverReducePath, setHoverReduceIndex],
  );

  // The circle marks the reduce/substitution handle itself when one produces the
  // step's expected equation; otherwise it marks the node box (selection/
  // transposition steps).
  const isHandleMarked = isOnboardingActive && onboardingReduceHandle?.path === path;
  const isSubHandleMarked = isOnboardingActive && onboardingSubstitution?.path === path;
  // The "click here" circle yields once its node is selected as Source — from
  // there the Source styling acknowledges the click and the target circle
  // takes over guiding the next one.
  const isOnboardingMarked = !isHandleMarked && !isSubHandleMarked &&
    ((path === onboardingHighlightPath && sourcePath !== path) ||
      (isOnboardingActive && path === onboardingTargetPath));

  const node = React.useMemo(() => {
    try {
      return getNodeByPath(currentEq, path);
    } catch {
      return null;
    }
  }, [currentEq, path]);

  const nodeId = node ? (node as unknown as { id?: string }).id || '' : '';

  // Tall root-index placement (#201). A fraction/radical index grows the node box and
  // must be lifted so it floats just above the radical's crook, not down at its vertex.
  // The crook is at RADICAL_CROOK_FRACTION of the radical's height, so the gap beneath
  // the index (down to the vertex) is a function of the index's own height. That height
  // varies (a fraction vs a nested radical), so we measure the rendered index and express
  // the gap in em — scale-invariant, so the nestle holds at every auto-scale.
  const rootIndexIsTall = hasTallRootIndex(node);
  const indexSlotRef = React.useRef<HTMLDivElement>(null);
  const [indexBox, setIndexBox] = React.useState({ minW: 0, minH: 0, seatBottomEm: INDEX_INSET_EM });
  React.useLayoutEffect(() => {
    const col = indexSlotRef.current;
    if (!rootIndexIsTall || !col) {
      setIndexBox({ minW: 0, minH: 0, seatBottomEm: INDEX_INSET_EM });
      return;
    }
    // Crook-relative seating (#201). The index is absolutely positioned so its bottom
    // rides the crook line (`bottom: (1−crookFraction) of the row height`), which tracks
    // the crook no matter what drives the row height — the index itself OR a taller
    // radicand. Absolute content contributes no size to its column, so we measure the
    // rendered index and reserve that footprint back.
    //
    // The index keeps its normal handle band (a FIXED-rem top reserve, like every other
    // node), so we must split the two unit systems: the em EXPRESSION seats in the pocket
    // and stays scale-invariant, while the fixed-rem handle reserve pokes ABOVE the
    // radical top into the root's handle band. We read the child node's real top/bottom
    // padding off the DOM (whatever it is — full handle reserve, or just nodePy when the
    // index has no handles) and subtract it, so the pocket is sized to the bare
    // expression, not the padded box.
    //   • minWidth keeps the node box wrapped around the index — including its handle band
    //     (#198), which also grows the box leftward for wide indices.
    //   • minHeight sizes the pocket to the bare expression + one bottom inset, so the
    //     expression's TOP sits flush with the radical top and its BOTTOM an inset off the
    //     crook. This reserved height also makes the row height "definite" so the % seat
    //     resolves.
    //   • seatBottomEm offsets the box bottom by the child's bottom padding so the
    //     EXPRESSION (not the padded box edge) lands an inset above the crook.
    const measure = () => {
      const wrapper = col.firstElementChild as HTMLElement | null;
      const childEl = wrapper?.querySelector('[data-eq-node]') as HTMLElement | null;
      const fontSize = parseFloat(getComputedStyle(col).fontSize);
      if (!wrapper || !childEl || !fontSize) return;
      const cs = getComputedStyle(childEl);
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 0;
      const exprEm = (childEl.offsetHeight - padTop - padBottom) / fontSize;
      const padBottomEm = padBottom / fontSize;
      const minW = Math.max(0, wrapper.offsetWidth / fontSize + INDEX_ARM_RIGHT_MARGIN_EM);
      const minH = (exprEm + INDEX_INSET_EM) / RADICAL_CROOK_FRACTION;
      const seatBottomEm = INDEX_INSET_EM - padBottomEm;
      setIndexBox((prev) =>
        Math.abs(prev.minW - minW) > 0.001 ||
        Math.abs(prev.minH - minH) > 0.001 ||
        Math.abs(prev.seatBottomEm - seatBottomEm) > 0.001
          ? { minW, minH, seatBottomEm }
          : prev,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(col.firstElementChild ?? col);
    return () => observer.disconnect();
  }, [rootIndexIsTall, node]);

  const getChildId = (index: number): string => {
    if (!node) return `${path}/${index}`;
    try {
      const children = getChildren(node);
      if (children && children[index]) {
        return (children[index] as unknown as { id?: string }).id || `${path}/${index}`;
      }
    } catch {}
    return `${path}/${index}`;
  };

  const getOpStyle = (isDivElement: boolean = false): React.CSSProperties => {
    const displayStyle = isDivElement ? {} : { display: 'inline-block' };
    return {
      ...displayStyle,
      transition: 'all 150ms ease-in-out',
    };
  };

  const getNodePadding = (p: string) => {
    const pLayout = inExponent ? MATH_LAYOUT.exponent : MATH_LAYOUT.normal;
    const pAllActions = reduciblePaths[p] || [];
    const pActions = !isOnboardingActive
      ? pAllActions
      : (isOnboardingActive && onboardingReduceHandle && onboardingReduceHandle.path === p && pAllActions[onboardingReduceHandle.index])
        ? [pAllActions[onboardingReduceHandle.index]]
        : [];
    
    const pAllSubstitutions = substitutionPaths[p] || [];
    const pSubstitutions = !isOnboardingActive
      ? pAllSubstitutions
      : (isOnboardingActive && onboardingSubstitution && onboardingSubstitution.path === p && pAllSubstitutions[onboardingSubstitution.index])
        ? [pAllSubstitutions[onboardingSubstitution.index]]
        : [];

    const hasReduce = pActions.some(a => a.type === 'reduce');
    const hasDistribute = pActions.some(a => a.type === 'distribute');
    const hasIdentity = pActions.some(a => a.type === 'identity');
    const hasSubstitute = pSubstitutions.length > 0;

    let handleCount = 0;
    if (hasReduce) handleCount++;
    if (hasDistribute) handleCount++;
    if (hasIdentity) handleCount++;
    if (hasSubstitute) handleCount++;

    // Handle nodes reserve a fixed (rem) band; bare nodes reserve em padding that
    // scales with their text. Returned as CSS length strings so callers can mix
    // the two units via CSS max() (#121).
    const pPaddingTop = handleCount > 0
      ? handleReserve(pLayout)
      : `${pLayout.nodePy}em`;

    return {
      paddingTop: pPaddingTop,
      paddingBottom: `${pLayout.nodePy}em`,
    };
  };

  const isSelected = sourcePath === path;
  const isHovered = hoverPath === path;
  const isTarget = !!sourcePath && path in targetPaths;
  const isCandidate = candidatePaths.has(path);
  const isStatic = sourcePath
    ? (!isSelected && !isTarget)
    : !isCandidate;

  // Determine if the user is hovering over any candidate node (or inside one)
  const isHoveringAnyCandidate = React.useMemo(() => {
    if (hoverPath === null) return false;
    if (candidatePaths.has(hoverPath)) return true;
    const parts = hoverPath.split('/');
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestorPath = parts.slice(0, i).join('/');
      if (candidatePaths.has(ancestorPath)) {
        return true;
      }
    }
    return false;
  }, [hoverPath, candidatePaths]);

  // During the tour, only the specific handle the tutorial wants clicked is
  // offered (the one whose result matches the step's expected equation);
  // every other handle is locked out like the rest of the UI.
  const actions = React.useMemo(() => {
    const all = reduciblePaths[path] || [];
    if (!isOnboardingActive) return all;
    return isHandleMarked && onboardingReduceHandle && all[onboardingReduceHandle.index]
      ? [all[onboardingReduceHandle.index]]
      : [];
  }, [reduciblePaths, path, isOnboardingActive, isHandleMarked, onboardingReduceHandle]);

  // Substitution handles (#3): offered on variable nodes matching a fact from
  // another workspace. During the tour, only the option the step expects is live
  // (mirrors the reduce-handle lockdown).
  const substitutions = React.useMemo(() => {
    const all = substitutionPaths[path] || [];
    if (!isOnboardingActive) return all;
    return isSubHandleMarked && onboardingSubstitution && all[onboardingSubstitution.index]
      ? [all[onboardingSubstitution.index]]
      : [];
  }, [substitutionPaths, path, isOnboardingActive, isSubHandleMarked, onboardingSubstitution]);

  // Toggle Root Sign (+/- branches) via global action
  const handleToggleRootSign = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleRootSign(path);
    trackEvent({
      action: 'toggle_root_sign',
      category: 'math_interaction',
      label: path,
    });
  };

  const getTargetPath = (): string | null => {
    if (!sourcePath) return null;
    if (isTarget) return path;
    const parts = path.split('/');
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestorPath = parts.slice(0, i).join('/');
      if (ancestorPath in targetPaths) {
        return ancestorPath;
      }
    }
    return null;
  };

  // The actionable core shared by mouse click and keyboard activation (#231).
  // It applies the same onboarding gating, target-apply, and toggle-select logic
  // regardless of input modality; event-specific concerns (stopPropagation,
  // preventDefault) stay in the wrappers below.
  const activateNode = () => {
    if (isStatic) {
      return;
    }

    if (isOnboardingActive) {
      if (sourcePath) {
        // A source is selected: only a valid target is actionable. Re-activating
        // the source (or any non-target node) is blocked — otherwise the
        // toggle-select branch below would deselect it and desync step order.
        const activeTargetPath = getTargetPath();
        if (!activeTargetPath) return;
      } else {
        // Steps that expect a handle click (reduce or substitution) lock out
        // node selection entirely — only the handle button is live.
        if (onboardingReduceHandle || onboardingSubstitution) return;
        if (path !== onboardingHighlightPath) return;
      }
    }

    const activeTargetPath = getTargetPath();
    if (activeTargetPath && sourcePath) {
      pushEquation(
        targetPaths[activeTargetPath],
        undefined,
        describeTransposition(currentEq, sourcePath, activeTargetPath) ?? undefined,
      );
      trackEvent({
        action: 'apply_transposition',
        category: 'math_interaction',
        label: `${sourcePath} -> ${activeTargetPath}`,
      });
      return;
    }

    // Toggle select
    if (isSelected) {
      setSourcePath(null);
      trackEvent({
        action: 'deselect_node',
        category: 'math_interaction',
        label: path,
      });
    } else {
      setSourcePath(path);
      trackEvent({
        action: 'select_node',
        category: 'math_interaction',
        label: path,
      });
    }
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    // During the tour no node click may bubble to the workspace canvas, whose
    // onClick deselects the source (page.tsx). Otherwise a blocked/static click
    // would clear the selection and desync step order. activateNode still decides
    // which clicks actually do something.
    if (isOnboardingActive) {
      e.stopPropagation();
    }

    if (isStatic) {
      return;
    }

    e.stopPropagation();
    activateNode();
  };

  // Escape "step out" (#271): rather than ejecting to the top of the widget,
  // Escape resumes the user's place one level out — it focuses the nearest
  // enclosing term (re-spoken by landing on it), so stepping out of a deep nested
  // sub-expression never strands a screen-reader user above the workspace toolbar.
  // `includeSelf` lets a handle return to its own term first (the handle hangs off
  // `origin`); a term passes false so it climbs to a strict ancestor. Only when
  // there is no enclosing term does it release to the region container — the
  // genuine top-level exit (#257 WCAG "release").
  const stepOutFrom = React.useCallback(
    (origin: string, includeSelf: boolean) => {
      if (!roving) return;
      const keys = roving.orderedKeys();
      if (includeSelf && keys.includes(origin)) {
        roving.setActive(origin, { focus: true });
        return;
      }
      const ancestor = keys
        .filter((k) => origin.startsWith(k + '/'))
        .sort((a, b) => b.length - a.length)[0];
      if (ancestor) roving.setActive(ancestor, { focus: true });
      else roving.focusContainer();
    },
    [roving],
  );

  // Keyboard model for the expression composite widget (#231, #257). Enter/Space
  // activate the node; arrow keys rove between actionable terms (Left/Right in
  // document order, Up/Down along the AST to an ancestor/descendant candidate,
  // Home/End to the ends); Escape clears a live selection, then steps out to the
  // enclosing term (#271) — releasing to the region container only at the top.
  // Tab/Shift+Tab are left untouched so focus exits the widget naturally
  // (WCAG 2.1.2, not a focus trap).
  const handleNodeKeyDown = (e: React.KeyboardEvent) => {
    // Only this node's own box drives term navigation. Keydowns bubbling up from a
    // descendant treeitem or a folded-in handle button are owned by those elements
    // (each stops/handles its own keys), so the ancestor must not double-act (#257).
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      e.stopPropagation();
      activateNode();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (isSelected) {
        // Cancelling a live selection is a deliberate "I'm done" exit: deselect
        // and release to the region container (the #257 WCAG release).
        setSourcePath(null);
        trackEvent({
          action: 'deselect_node',
          category: 'math_interaction',
          label: path,
        });
        roving?.focusContainer();
        return;
      }
      // Plain navigation: step out one enclosing level instead of ejecting (#271).
      stepOutFrom(path, false);
      return;
    }
    if (!roving) return;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        roving.moveFocus('next');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        roving.moveFocus('prev');
        break;
      case 'Home':
        e.preventDefault();
        e.stopPropagation();
        roving.moveFocus('first');
        break;
      case 'End':
        e.preventDefault();
        e.stopPropagation();
        roving.moveFocus('last');
        break;
      case 'ArrowDown': {
        // Nearest descendant candidate (fewest extra path segments), document
        // order breaking ties.
        e.preventDefault();
        e.stopPropagation();
        const descendant = roving
          .orderedKeys()
          .filter((k) => k.startsWith(path + '/'))
          .map((k) => ({ k, depth: k.split('/').length }))
          .sort((a, b) => a.depth - b.depth)[0];
        if (descendant) roving.setActive(descendant.k, { focus: true });
        break;
      }
      case 'ArrowUp': {
        // Closest ancestor candidate (longest matching path prefix).
        e.preventDefault();
        e.stopPropagation();
        const ancestor = roving
          .orderedKeys()
          .filter((k) => path.startsWith(k + '/'))
          .sort((a, b) => b.length - a.length)[0];
        if (ancestor) roving.setActive(ancestor, { focus: true });
        break;
      }
    }
  };

  // Styling hooks
  const canClick = sourcePath ? (isSelected || isTarget) : isCandidate;

  // Roving integration (#257): the controller's active candidate is the single
  // Tab stop (tabIndex 0); every other candidate is -1. Outside a provider, fall
  // back to the legacy behavior where every candidate is its own Tab stop.
  // Only a transposition-actionable node (canClick) is a roving *term* — Enter on
  // it selects/applies. A node that is a treeitem solely to host a handle (see
  // isTreeitem below) is never the active term, so it stays tabIndex -1 and does
  // not register; its handle registers instead. Reading every sub-term is the job
  // of Exploration mode (#270), a separate clean tree — Interaction mode keeps the
  // #257 actionable-only roving so hunting the move handles stays natural.
  const rovingTabIndex = roving
    ? (canClick && roving.activeKey === path ? 0 : -1)
    : (canClick ? 0 : -1);
  const registerRovingItem = React.useCallback(
    (el: HTMLElement | null) => {
      if (!roving || !canClick) return;
      if (el) roving.registerItem(path, el);
      else roving.unregisterItem(path);
    },
    [roving, path, canClick],
  );

  // Handle buttons fold into the SAME roving sequence as the terms (#257): each is
  // its own item keyed `${path}#${type}`, so the whole expression remains a single
  // Tab stop and arrow keys reach the handles in document order. One stable ref
  // callback per stack type (there are only four), rebuilt when the controller
  // changes, mirroring registerRovingItem — stable identity avoids registry churn.
  const handleRovingRefs = React.useMemo(() => {
    const make = (key: string) => (el: HTMLElement | null) => {
      if (!roving) return;
      // Secondary: a handle is arrow-reachable but never the default Tab entry
      // point, so Tab never lands on a handle ahead of its term (#257).
      if (el) roving.registerItem(key, el, { primary: false });
      else roving.unregisterItem(key);
    };
    return {
      reduce: make(`${path}#reduce`),
      distribute: make(`${path}#distribute`),
      identity: make(`${path}#identity`),
      substitute: make(`${path}#substitute`),
    } as Record<'reduce' | 'distribute' | 'identity' | 'substitute', (el: HTMLElement | null) => void>;
  }, [roving, path]);

  const handleRovingKeyDown = React.useCallback(
    (e: React.KeyboardEvent, stackType: 'reduce' | 'distribute' | 'identity' | 'substitute') => {
      switch (e.key) {
        case 'ArrowRight':
          if (roving) { e.preventDefault(); e.stopPropagation(); roving.moveFocus('next'); }
          break;
        case 'ArrowLeft':
          if (roving) { e.preventDefault(); e.stopPropagation(); roving.moveFocus('prev'); }
          break;
        case 'Home':
          if (roving) { e.preventDefault(); e.stopPropagation(); roving.moveFocus('first'); }
          break;
        case 'End':
          if (roving) { e.preventDefault(); e.stopPropagation(); roving.moveFocus('last'); }
          break;
        case 'Escape':
          // An open multi-option menu closes first; otherwise step out to the
          // handle's own term (re-spoken), matching the term's Escape behavior —
          // resuming the user's place rather than ejecting to the top (#271).
          if (openMenuType === stackType) {
            e.stopPropagation();
            closeMenu();
          } else if (roving) {
            e.preventDefault();
            e.stopPropagation();
            stepOutFrom(path, true);
          }
          break;
      }
    },
    [roving, openMenuType, closeMenu, stepOutFrom, path],
  );

  // Only dim candidate nodes if the user is actively hovering over *some* valid candidate.
  // Otherwise, if they hover static parts of the expression, keep all candidates bright (scan mode).
  const isHighlightedCandidate = isCandidate && !sourcePath && (!isHoveringAnyCandidate || isHovered);

  const semanticStyle = isSelected
    ? THEME_GLASS.SOURCE
    : isTarget
    ? THEME_GLASS.TARGET
    : isStatic
    ? THEME_GLASS.STATIC + ' select-none'
    : isHighlightedCandidate
    ? THEME_GLASS.CARD_CANDIDATE_SCAN
    : canClick
    ? THEME_GLASS.CARD_CANDIDATE
    : THEME_GLASS.CARD_CANDIDATE + ' cursor-default';

  // Recursive Render logic depending on Node type
  const renderContent = () => {
    if (!node) return null;
    if (node.type === 'ConstantNode') {
      const constNode = node as math.ConstantNode;
      return (
        <span className={`font-semibold ${isStatic ? THEME_GLASS.MATH_NUMBER_STATIC : THEME_GLASS.MATH_NUMBER_ACTIVE}`}>
          {formatNumber(constNode.value)}
        </span>
      );
    }

    if (node.type === 'SymbolNode') {
      const symbolNode = node as math.SymbolNode;
      // The imaginary unit renders as an UPRIGHT roman i (ISO-80000-2), which is
      // what visually distinguishes the constant ⅈ from the italic variable i —
      // we draw our own `i` rather than relying on the app font shipping the
      // U+2148 glyph (avoids tofu, keeps the render style free to change). (#105)
      if (isImaginaryUnit(symbolNode.name)) {
        return (
          <span className={`not-italic font-serif ${isStatic ? THEME_GLASS.MATH_VAR_STATIC : THEME_GLASS.MATH_VAR_ACTIVE} font-medium`}>
            i
          </span>
        );
      }
      const { head, sub } = splitSubscript(symbolNode.name);
      return (
        <span className={`italic font-serif ${isStatic ? THEME_GLASS.MATH_VAR_STATIC : THEME_GLASS.MATH_VAR_ACTIVE} font-medium`}>
          {head}
          {sub !== null && <sub className={THEME_GLASS.MATH_SUBSCRIPT}>{sub}</sub>}
        </span>
      );
    }

    if (node.type === 'ParenthesisNode') {
      const childPath = `${path}/0`;
      const childPadding = getNodePadding(childPath);
      return (
        <div className="flex items-stretch px-[0.05em] relative">
          <div className="relative w-[0.32em] select-none shrink-0">
            <div
              className="absolute inset-x-0"
              style={{
                top: childPadding.paddingTop,
                bottom: childPadding.paddingBottom
              }}
            >
              <LeftParenSVG
                className={`w-full h-full ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`}
                style={getOpStyle()}
              />
            </div>
          </div>
          <div className="px-[0.05em]">
            <EquationNode path={childPath} key={getChildId(0)} inExponent={inExponent} />
          </div>
          <div className="relative w-[0.32em] select-none shrink-0">
            <div
              className="absolute inset-x-0"
              style={{
                top: childPadding.paddingTop,
                bottom: childPadding.paddingBottom
              }}
            >
              <RightParenSVG
                className={`w-full h-full ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`}
                style={getOpStyle()}
              />
            </div>
          </div>
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        // A unary minus applied to another unary minus would render as an ambiguous
        // "−−3"; parenthesize the operand so it reads "−(−3)", matching the engine's
        // own equationToString. Real ParenthesisNodes handle every other case.
        const child = opNode.args[0];
        const childNeedsParens =
          opNode.op === '-' &&
          child.type === 'OperatorNode' &&
          (child as math.OperatorNode).isUnary() &&
          (child as math.OperatorNode).op === '-';
        // Share one top-boundary offset with the operand so the unary glyph
        // lines up with the operand's text rather than its box center (#30).
        const unaryTop = getNodePadding(`${path}/0`).paddingTop;
        return (
          <div className="flex items-center gap-[0.05em]">
            <span className={`font-bold select-none ${isStatic ? THEME_GLASS.MATH_OP_STATIC : THEME_GLASS.MATH_OP_UNARY_ACTIVE}`} style={{ ...getOpStyle(), display: 'inline-flex', alignItems: 'center', paddingTop: unaryTop, paddingBottom: `${layout.nodePy}em` }}>{opSymbol}</span>
            {childNeedsParens ? (
              (() => {
                const childPath = `${path}/0`;
                const childPadding = getNodePadding(childPath);
                return (
                  <div className="flex items-stretch px-[0.05em] relative">
                    <div className="relative w-[0.32em] select-none shrink-0">
                      <div
                        className="absolute inset-x-0"
                        style={{
                          top: childPadding.paddingTop,
                          bottom: childPadding.paddingBottom
                        }}
                      >
                        <LeftParenSVG
                          className={`w-full h-full ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`}
                          style={getOpStyle()}
                        />
                      </div>
                    </div>
                    <div className="px-[0.05em]">
                      <EquationNode path={childPath} key={getChildId(0)} inExponent={inExponent} />
                    </div>
                    <div className="relative w-[0.32em] select-none shrink-0">
                      <div
                        className="absolute inset-x-0"
                        style={{
                          top: childPadding.paddingTop,
                          bottom: childPadding.paddingBottom
                        }}
                      >
                        <RightParenSVG
                          className={`w-full h-full ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`}
                          style={getOpStyle()}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} minPaddingTop={unaryTop} />
            )}
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className={`flex flex-col items-center justify-center ${inExponent ? 'mx-[0.05em] my-[0.02em] text-[0.7em] leading-none' : 'mx-[0.1em] my-[0.05em]'}`}>
            <div className={`w-full text-center ${inExponent ? 'pb-[0.02em]' : 'pb-[0.1em]'}`}>
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} fillRowHit={true} />
            </div>
            <div className={`w-full border-t ${isStatic ? THEME_GLASS.MATH_BORDER_STATIC : THEME_GLASS.MATH_BORDER_ACTIVE} h-0`} style={getOpStyle(true)} />
            <div className={`w-full text-center ${inExponent ? 'pt-[0.02em]' : 'pt-[0.1em]'}`}>
              <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={inExponent} fillRowHit={true} />
            </div>
          </div>
        );
      }

      // Binary Exponentiation operator (Superscript rendering).
      // Align the exponent to the TOP of the base (items-start) rather than a
      // shared baseline: a tall flex-container base like (x+2) has no real text
      // baseline, so the flex spec synthesizes one at its bottom edge — making a
      // fixed upward offset land the exponent at the base's vertical midline,
      // where it reads as multiplication (#194). Top-anchoring makes a proper
      // raised superscript regardless of how tall the base group is.
      if (opNode.op === '^') {
        return (
          <div className="inline-flex items-start">
            <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
            <div className="text-[0.65em] ml-[0.05em] opacity-90 scale-90 relative" style={{ top: '-0.4em', display: 'inline-block' }}>
              <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={true} />
            </div>
          </div>
        );
      }

      // Normal binary operators (+, -, *) — centralized display glyphs (#28).
      const opSymbol = OPERATOR_DISPLAY[opNode.op] || opNode.op;

      // Baseline alignment (#30): reserve the row-wide max top padding on both
      // operands AND the operator glyph so every box shares one top-boundary
      // offset and their content centers (text baselines) line up — instead of
      // a handle-bearing operand dropping its text below its bare siblings.
      const rowTop = cssMax(
        getNodePadding(`${path}/0`).paddingTop,
        getNodePadding(`${path}/1`).paddingTop,
      );

      return (
        <div className="flex items-center gap-[0.2em] flex-nowrap justify-center py-[0.05em]">
          <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} minPaddingTop={rowTop} />
          {/* Outer span carries the shared padding at the parent's em (the inner
              glyph is text-[0.85em], so padding em on it would be mis-scaled). */}
          <span style={{ paddingTop: rowTop, paddingBottom: `${layout.nodePy}em`, display: 'inline-flex', alignItems: 'center' }}>
            <span className={`font-medium select-none text-[0.85em] ${isStatic ? THEME_GLASS.MATH_OP_STATIC : THEME_GLASS.MATH_OP_ACTIVE}`} style={getOpStyle()}>{opSymbol}</span>
          </span>
          <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={inExponent} minPaddingTop={rowTop} />
        </div>
      );
    }

    if (node.type === 'FunctionNode') {
      const funcNode = node as math.FunctionNode;
      const nameStr = getFunctionName(funcNode);

      if (nameStr === 'nthRoot') {
        let showIndex = funcNode.args.length > 1;
        if (showIndex) {
          let unwrapped = funcNode.args[1];
          while (unwrapped && unwrapped.type === 'ParenthesisNode') {
            unwrapped = (unwrapped as math.ParenthesisNode).content;
          }
          if (unwrapped && unwrapped.type === 'ConstantNode' && (((unwrapped as math.ConstantNode).value as unknown) === 2 || ((unwrapped as math.ConstantNode).value as unknown) === '2')) {
            showIndex = false;
          }
        }
        return (
          <div className="flex items-stretch -ml-[0.1em] -mr-[0.2em] relative">
            {DEBUG_CROOK && rootIndexIsTall && (
              // Crook line: where the index's bottom should seat. The index slot itself
              // is ring-outlined below, so its lower-right corner should land on this
              // line, nestled against the rising arm.
              <div
                className="pointer-events-none absolute left-0 right-0 z-50 border-t-2 border-emerald-400/90"
                style={{ top: `${RADICAL_CROOK_FRACTION * 100}%` }}
              />
            )}
            {showIndex && (rootIndexIsTall ? (
              // Tall index (fraction/nested radical), crook-relative seating (#201).
              // The column is a full-height flex item (stretches to the row); the index
              // content inside is absolutely positioned with its expression bottom an inset
              // above the crook line (`bottom: (1−crookFraction) of the height`), so it
              // rides the crook whether the index or a taller radicand drives the height.
              // The column reserves the index's measured footprint (minWidth/minHeight
              // from the effect above) so the node box still wraps it (#198) and the row
              // grows tall enough to hold it. The index keeps its normal handle band —
              // that fixed-rem top reserve pokes ABOVE the radical top into the root's
              // handle band, while the em expression stays seated in the pocket (the
              // effect splits the two so scale-invariance survives).
              <div
                ref={indexSlotRef}
                className="relative shrink-0 z-10"
                style={{ minWidth: `${indexBox.minW}em`, minHeight: `${indexBox.minH}em` }}
              >
                <div
                  data-crookdebug={DEBUG_CROOK ? 'index' : undefined}
                  className={`absolute ${DEBUG_CROOK ? 'ring-2 ring-red-500/90' : ''}`}
                  style={{
                    // right/bottom are in the COLUMN's em (this wrapper's font-size), so
                    // the inset math lands at the intended scale. The 0.5em shrink lives
                    // on the inner element only.
                    right: `${INDEX_ARM_RIGHT_MARGIN_EM}em`,
                    bottom: `calc(${((1 - RADICAL_CROOK_FRACTION) * 100).toFixed(4)}% + ${indexBox.seatBottomEm.toFixed(4)}em)`,
                  }}
                >
                  <div className="text-[0.5em]" style={getOpStyle()}>
                    <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={inExponent} />
                  </div>
                </div>
              </div>
            ) : (
              // Short digit index: a normal flow item (not absolutely positioned) so the
              // node box grows to contain it instead of spilling past the left edge
              // (#198). Bottom-anchored (items-end) so its glyph sits at a stable height;
              // the negative right margin nestles it against the rising stroke.
              <div className="relative self-start shrink-0 flex items-end min-h-[0.96em] -mr-[0.35em] z-10 translate-y-[0.05em]">
                <div className="text-[0.5em]" style={getOpStyle()}>
                  <EquationNode path={`${path}/1`} key={getChildId(1)} inExponent={inExponent} suppressHandleReserve />
                </div>
              </div>
            ))}
            <div
              className="relative select-none shrink-0 mr-[-1px]"
              style={{ width: `${RADICAL_SVG_WIDTH_EM}em` }}
              data-crookdebug={DEBUG_CROOK && rootIndexIsTall ? 'svg' : undefined}
            >
              <svg
                viewBox="0 0 12 100"
                preserveAspectRatio="none"
                className={`absolute inset-0 w-full h-full overflow-visible ${isStatic ? THEME_GLASS.MATH_FN_ROOT_STATIC : THEME_GLASS.MATH_FN_ROOT_ACTIVE}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={getOpStyle()}
              >
                <path
                  d={radicalPath(rootIndexIsTall ? Math.round(RADICAL_CROOK_FRACTION * 100) : RADICAL_DEFAULT_CROOK_Y)}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {DEBUG_CROOK && rootIndexIsTall && (
                  // Vertical reference in the SAME coord space as the arm, so it is
                  // guaranteed to sit on the arm at the crook (they cross at y = crook).
                  // This is the target the index's right edge is inset from — its right gap
                  // to this line should match its bottom gap to the green crook line.
                  <line
                    x1={RADICAL_ARM_X_AT_CROOK}
                    y1={0}
                    x2={RADICAL_ARM_X_AT_CROOK}
                    y2={100}
                    stroke="#38bdf8"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            </div>
            <div className={`border-t pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center ${isStatic ? THEME_GLASS.MATH_BORDER_FN_STATIC : THEME_GLASS.MATH_BORDER_FN_ACTIVE}`} style={getOpStyle(true)}>
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
            </div>
          </div>
        );
      }

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch -ml-[0.1em] -mr-[0.2em] relative">
            <div
              className="relative select-none shrink-0 mr-[-1px]"
              style={{ width: `${RADICAL_SVG_WIDTH_EM}em` }}
            >
              <svg
                viewBox="0 0 12 100"
                preserveAspectRatio="none"
                className={`absolute inset-0 w-full h-full overflow-visible ${isStatic ? THEME_GLASS.MATH_FN_ROOT_STATIC : THEME_GLASS.MATH_FN_ROOT_ACTIVE}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={getOpStyle()}
              >
                <path
                  d={radicalPath(RADICAL_DEFAULT_CROOK_Y)}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className={`border-t pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center ${isStatic ? THEME_GLASS.MATH_BORDER_FN_STATIC : THEME_GLASS.MATH_BORDER_FN_ACTIVE}`} style={getOpStyle(true)}>
              <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
            </div>
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-[0.05em]">
          <span className={`font-medium select-none text-[0.9em] ${isStatic ? THEME_GLASS.MATH_FN_STATIC : THEME_GLASS.MATH_FN_ACTIVE}`} style={getOpStyle()}>{nameStr}</span>
          <span className={`mr-[0.05em] ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`} style={getOpStyle()}>(</span>
          <EquationNode path={`${path}/0`} key={getChildId(0)} inExponent={inExponent} />
          <span className={`ml-[0.05em] ${isStatic ? THEME_GLASS.MATH_OP_MUTED_STATIC : THEME_GLASS.MATH_OP_MUTED_ACTIVE}`} style={getOpStyle()}>)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  const layout = inExponent ? MATH_LAYOUT.exponent : MATH_LAYOUT.normal;

  const interactionStacks = React.useMemo(() => {
    const stacks: {
      type: 'reduce' | 'distribute' | 'identity' | 'substitute';
      options: UnifiedStackOption[];
    }[] = [];

    const reduceOptions: UnifiedStackOption[] = [];
    const distributeOptions: UnifiedStackOption[] = [];
    const identityOptions: UnifiedStackOption[] = [];

    actions.forEach((action, idx) => {
      // Describe the move up front so its domain restrictions (#63) can be shown
      // on the handle/menu *before* the student applies it (#59) — the same
      // `change` is reused on apply so we don't describe twice.
      const change = describeReduction(currentEq, {
        path,
        simplified: action.equation,
        type: action.type as 'reduce' | 'distribute' | 'identity',
        label: action.label,
      });
      const opt: UnifiedStackOption = {
        id: `action-${action.type}-${idx}`,
        label: action.label || (action.type === 'distribute' ? "Distribute" : action.type === 'identity' ? "Apply Identity" : "Simplify"),
        equation: action.equation,
        originalOption: action,
        assumptions: change.assumptions,
        onApply: () => {
          const reductionLabel = action.label || (action.type === 'distribute' ? 'Distribute' : action.type === 'identity' ? 'Apply Identity' : 'Simplify');
          pushEquation(action.equation, reductionLabel, change);
          trackEvent({
            action: 'apply_reduction',
            category: 'math_interaction',
            label: `${action.type}: ${action.label || (action.type === 'distribute' ? 'Distribute' : 'Simplify')}`,
          });
        }
      };

      if (action.type === 'reduce') {
        reduceOptions.push(opt);
      } else if (action.type === 'distribute') {
        distributeOptions.push(opt);
      } else if (action.type === 'identity') {
        identityOptions.push(opt);
      }
    });

    const substituteOptions: UnifiedStackOption[] = substitutions.map((sub, idx) => ({
      id: `substitute-${idx}`,
      label: sub.type === 'reverse'
        ? `Collapse ${sub.replacement} → ${sub.variable}`
        : `Substitute ${sub.variable} = ${sub.replacement}`,
      subLabel: sub.fact.sourceName ? `from “${sub.fact.sourceName}”` : undefined,
      equation: sub.substituted,
      originalOption: sub,
      onApply: () => {
        pushEquation(
          sub.substituted,
          sub.type === 'reverse' ? 'Collapse' : 'Substitute',
          sub.type === 'reverse'
            ? describeCollapse(sub.replacement, sub.variable)
            : describeSubstitution(sub.variable, sub.replacement),
        );
        trackEvent({
          action: sub.type === 'reverse' ? 'apply_collapse' : 'apply_substitution',
          category: 'math_interaction',
          label: sub.type === 'reverse'
            ? `${sub.replacement} -> ${sub.variable}`
            : `${sub.variable} -> ${sub.replacement}`,
        });
      }
    }));

    // De-emphasize "Evaluate to Decimal" (#66): when the reduce stack is *only*
    // decimal evaluation, it competes with an exact-form move that lives in a
    // different type-stack (e.g. √2's "Square Root to Fractional Power" is an
    // identity). Sink that decimal-only handle below the exact stacks so the
    // exact move reads as the headline; decimal stays available as an opt-in.
    // A mixed reduce stack keeps its lead — the engine already orders decimal
    // last *within* it (getReducibleOptions).
    const reduceIsDecimalOnly =
      reduceOptions.length > 0 &&
      reduceOptions.every((o) => o.label === 'Evaluate to Decimal');

    if (reduceOptions.length > 0 && !reduceIsDecimalOnly) {
      stacks.push({ type: 'reduce', options: reduceOptions });
    }
    if (distributeOptions.length > 0) {
      stacks.push({ type: 'distribute', options: distributeOptions });
    }
    if (identityOptions.length > 0) {
      stacks.push({ type: 'identity', options: identityOptions });
    }
    if (substituteOptions.length > 0) {
      stacks.push({ type: 'substitute', options: substituteOptions });
    }
    if (reduceOptions.length > 0 && reduceIsDecimalOnly) {
      stacks.push({ type: 'reduce', options: reduceOptions });
    }

    return stacks;
  }, [actions, substitutions, currentEq, path, pushEquation]);

  // All hooks above run unconditionally; only now is it safe to bail out if this
  // path no longer resolves to a node (the equation may have changed under us).
  if (!node) return null;

  // The node box reserves space for ALL its active stacks: top padding for the row,
  // and minWidth so the row never overhangs. The handle band is a fixed rem size
  // (#121) while the node's own side padding stays em, so minWidth combines both.
  const handleCount = interactionStacks.length;
  const handleBandWidth = (handleCount * layout.btnSize + (handleCount - 1) * layout.btnGap) * HANDLE_REM;
  const minWidth = handleCount > 0
    ? `calc(${handleBandWidth.toFixed(4)}rem + ${layout.nodePx * 2}em)`
    : undefined;

  // A parent row may force a larger top reserve (minPaddingTop) so this node's
  // text shares the same top-boundary offset as its handle-bearing siblings (#30).
  // Handle nodes reserve the fixed rem band; combine with the (possibly em) parent
  // floor via CSS max() since the units may differ.
  const ownPaddingTop = handleCount > 0 && !suppressHandleReserve ? handleReserve(layout) : `${layout.nodePy}em`;
  const paddingTop = cssMax(ownPaddingTop, minPaddingTop);

  const customStyle: React.CSSProperties = {
    transition: 'border-color 150ms, background-color 150ms, box-shadow 150ms, opacity 150ms',
    minWidth: minWidth,
    paddingLeft: `${layout.nodePx}em`,
    paddingRight: `${layout.nodePx}em`,
    paddingTop: paddingTop,
    paddingBottom: `${layout.nodePy}em`,
  };

  // Tab-to-green keyboard operability + screen-reader semantics (#231). Only an
  // actionable node (canClick) is a tab stop and a button; every other (static)
  // node stays out of the tab order and unlabelled so a screen reader isn't
  // forced to walk every nested container. The label reads the term plus the
  // action it offers in the current selection state. Speak the term as readable
  // math (#256) — "x squared", not the raw "x ^ 2" the AST string would give.
  const termText = nodeToSpeech(node);
  // A node hosts handles (Simplify/Distribute/…) only when its toolbar is live —
  // i.e. not while a transposition source is selected (the toolbar is inert then).
  const handlesNavigable = handleCount > 0 && !sourcePath;
  // A node is a treeitem if it is transposition-actionable (canClick) OR it hosts
  // a handle. The latter is essential: a handle <button> nested in a bare div
  // under role="tree" violates aria-required-children, so even a non-candidate
  // handle host must be a treeitem to keep its folded-in handle valid (#257).
  const isTreeitem = canClick || handlesNavigable;
  // Sparse verb phrasing (#270): the action verb is heard on every actionable term,
  // so it stays terse. (Reading non-actionable sub-terms is Exploration mode's job,
  // a separate tree — here every treeitem is actionable, so it always has a verb.)
  const nodeAriaLabel = isSelected
    ? `${termText}, selected`
    : isTarget
    ? `${termText}, Enter to move here`
    : isCandidate
    ? `${termText}, Enter to select`
    : isTreeitem
    ? termText
    : undefined;
  // Actionable terms are treeitems in a role="tree" composite widget (#257):
  // treeitem-in-treeitem is valid ARIA, unlike the button-in-button nesting it
  // replaces (which VoiceOver demoted to "group"). aria-selected carries the
  // selection state a treeitem expects (replacing button's aria-pressed), and is
  // emitted only on selectable (canClick) terms — a handle-only host is not
  // selectable. Static (non-actionable, non-handle) nodes carry no role or
  // tabIndex, so a role="tree" ancestor can validly own the treeitems nested
  // beneath these generic wrappers.
  const interactiveProps: React.HTMLAttributes<HTMLDivElement> & {
    tabIndex?: number;
    ref?: React.Ref<HTMLDivElement>;
  } = isTreeitem
    ? {
        role: 'treeitem',
        tabIndex: rovingTabIndex,
        ...(canClick ? { 'aria-selected': isSelected } : {}),
        'aria-label': nodeAriaLabel,
        onKeyDown: handleNodeKeyDown,
        ref: registerRovingItem,
      }
    : {};

  // ARIA tree structure (#257): a treeitem nested directly inside another treeitem
  // violates aria-required-parent — child treeitems must sit in a role="group".
  // A non-leaf treeitem's rendered content holds its operand treeitems, so wrap it
  // in a group. The wrapper is display:contents-free (a real inline-flex box, since
  // display:contents would drop the group role from the a11y tree) but shrink-wraps
  // its content, leaving the visual math layout unchanged. Leaves (constants /
  // symbols) need no wrapper at all.
  //
  // The wrapper is rendered for *every* non-leaf node and only its `role` toggles
  // with `isTreeitem` (#234). `isTreeitem` flips when the async math scan lands
  // (it keys off candidate/handle state), so making the wrapper itself
  // conditional would add/remove a parent element and remount the whole operand
  // subtree mid-transform — which silently wipes the in-flight FLIP slide. A
  // roleless div is transparent to the a11y tree, so toggling only the attribute
  // keeps both the semantics and the DOM structure stable.
  const isLeafNode = node.type === 'ConstantNode' || node.type === 'SymbolNode';
  const renderedContent = isLeafNode ? (
    renderContent()
  ) : (
    <div role={isTreeitem ? 'group' : undefined} className="inline-flex items-center justify-center">
      {renderContent()}
    </div>
  );

  const element = (
    <div
      data-flip-id={nodeId}
      data-eq-node=""
      style={customStyle}
      className={`relative inline-flex items-center justify-center border rounded-[0.4em] select-none ${THEME_GLASS.NODE_FOCUS_RING} ${semanticStyle}`}
      {...interactiveProps}
      onMouseEnter={() => {
        setHoverPath(path);
      }}
      onMouseLeave={() => {
        const lastSlash = path.lastIndexOf('/');
        const parentPath = lastSlash !== -1 ? path.substring(0, lastSlash) : null;
        setHoverPath(parentPath);
      }}
      onClick={handleNodeClick}
    >
      {renderedContent}

      {/* Onboarding annotation circle: a bright white loop overshooting the node box,
          deliberately outside the app's rounded-rect + hue vocabulary. Rendered as a
          child so it tracks FLIP moves, scaling, and reflows for free. */}
      {isOnboardingMarked && (
        <span aria-hidden="true" className={`-inset-[0.4em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
      )}

      {/* Hover selection controls toolbar */}
      {isSelected && canToggleRoot(node) && (
        <div className={`absolute -top-[2em] left-1/2 -translate-x-1/2 flex items-center gap-[0.1em] z-30 ${THEME_GLASS.MINI_TOOLBAR}`}>
          <Tooltip content="Toggle root sign (±)">
            <button
              onClick={handleToggleRootSign}
              className={THEME_GLASS.MINI_TOOLBAR_BUTTON}
            >
              <RefreshCw size={10} />
              <span>± Sign</span>
            </button>
          </Tooltip>
        </div>
      )}

      {/* Receptive target backing card transition layer */}
      {isTarget && (
        <div className={THEME_GLASS.TARGET_GLOW} />
      )}

      {/* Compact Inline Operations Toolbar - sits inside the top-padding area to prevent layout overlap */}
      {interactionStacks.length > 0 && (
        <div 
          className={`absolute flex items-center z-25 ${
            // Source-selection (transposition) mode dims/disables the whole toolbar.
            // The resting de-emphasis lives on the individual buttons (below) so the
            // count badges can stay full-opacity (opacity compounds through parents).
            sourcePath ? 'opacity-25 pointer-events-none grayscale' : 'opacity-100'
          }`}
          style={{
            // Fixed-size handles (#121): anchoring font-size to rem makes every em
            // dimension inside the toolbar (button, gap, badge, offsets) resolve
            // against a constant, so handles no longer scale with the expression's
            // auto-scale. btnTop/btnRight/btnGap are em ratios of this anchor.
            fontSize: `${HANDLE_REM}rem`,
            top: `${layout.btnTop}em`,
            right: `${layout.btnRight}em`,
            gap: `${layout.btnGap}em`,
            transition: 'opacity 200ms, filter 200ms',
          }}
        >
          {interactionStacks.map((stack) => {
            const config = STACK_CONFIG[stack.type];
            const IconComponent = config.icon;
            const single = stack.options.length === 1 ? stack.options[0] : null;

            // Roving integration (#257): the handle is its own item in the shared
            // sequence. It registers only while navigable (toolbar live), so a
            // transposition source selection (toolbar inert) folds it back out.
            const handleKey = `${path}#${stack.type}`;
            const handleTabIndex = roving
              ? (roving.activeKey === handleKey ? 0 : -1)
              : (sourcePath ? -1 : undefined);
            const handleRef = roving && handlesNavigable ? handleRovingRefs[stack.type] : undefined;

            const isStackMarked = isOnboardingActive && (
              (stack.type === 'substitute' && isSubHandleMarked) ||
              (stack.type !== 'substitute' && isHandleMarked && actions.length > 0 && actions[0].type === stack.type)
            );

            // Only the hovered node's handles pulse (#121); the onboarding tour
            // still forces its marked handle to pulse so the step reads.
            const pulse = shouldPulseHandle({ sourcePath, isHovered, isStackMarked, reducedMotion: !!reducedMotion });

            // Handles rest at full opacity for discoverability (the hue codes the
            // action type); only the pulse (animate-ping) is hover-gated, so the
            // pointed-at node's handles animate without dimming the rest into a
            // dingy resting state. The transposition-source dim still applies at
            // the toolbar level (sourcePath) — that's a deliberate "this is the
            // selected term" affordance, not resting de-emphasis.
            const buttonClass = `flex items-center justify-center cursor-pointer shadow-md transition-all duration-150 relative group hover:scale-110 opacity-100 ${config.handleClass}`;
            const buttonStyle: React.CSSProperties = {
              width: `${layout.btnSize}em`,
              height: `${layout.btnSize}em`,
              borderRadius: inExponent ? '0.12em' : '9999px',
            };
            const buttonInner = (
              <>
                <span
                  className={`absolute inset-0 group-hover:opacity-0 pointer-events-none ${
                    pulse ? 'animate-ping' : ''
                  } ${config.pingClass}`}
                  style={{ borderRadius: inExponent ? '0.12em' : '9999px' }}
                />
                {isStackMarked && (
                  <span aria-hidden="true" className={`-inset-[0.3em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
                )}
                <IconComponent className={`h-[65%] w-[65%] ${config.iconClass}`} />
              </>
            );

            // Count badge for multi-option stacks. Rendered as a sibling of the
            // button (not a child) — a bright accent inviting inspection of the
            // node's multiple options (#121). pointer-events-none so it never steals
            // hover from the button it overlaps.
            const badge = !single ? (
              <span
                className={`absolute flex items-center justify-center rounded-full font-bold border leading-none pointer-events-none ${config.badgeClass}`}
                style={{
                  fontSize: '0.4em',
                  height: '1.5em',
                  minWidth: '1.5em',
                  padding: '0 0.2em',
                  top: '-0.8em',
                  right: '-0.8em',
                }}
              >
                {/* Optical-center nudge: digits have no descender, so flex/line-box
                    centering leaves them riding high — push down a hair (#121). */}
                <span style={{ position: 'relative', top: '0.1em' }}>{stack.options.length}</span>
              </span>
            ) : null;

            // Single-option handle: a plain hover preview tooltip; click applies.
            if (single) {
              const singleTooltip = (
                <div className="flex flex-col items-center gap-1 py-1 px-0.5 max-w-[280px] sm:max-w-[340px]">
                  <span className="font-semibold text-zinc-100 text-xs tracking-wider select-none opacity-80">{single.label}</span>
                  {single.subLabel && (
                    <span className={`text-xs ${THEME_GLASS.TEXT_MUTED} select-none`}>{single.subLabel}</span>
                  )}
                  {single.assumptions && single.assumptions.length > 0 && (
                    <span className={`${THEME_GLASS.TOOLTIP_ASSUMPTION} select-none`}>
                      <TriangleAlert size={11} className={THEME_GLASS.TOOLTIP_ASSUMPTION_ICON} />
                      <span>assuming {single.assumptions.join(', ')}</span>
                    </span>
                  )}
                  <div className="w-full border-t border-white/10 my-1" />
                  <ScaledEquationFit measureEq={single.equation} className="max-w-[280px] sm:max-w-[340px]">
                    {renderEquationPreviewRow(single.equation, false)}
                  </ScaledEquationFit>
                </div>
              );
              return (
                <Tooltip
                  key={stack.type}
                  content={singleTooltip}
                  position="top"
                  // Suppress while the tree is mid-slide (#234): a freshly-revealed
                  // handle under the cursor must not auto-pop its tooltip over a
                  // term that is still moving.
                  visible={isTreeAnimating ? false : undefined}
                  className="max-w-[300px] sm:max-w-[360px]"
                >
                  <button
                    className={buttonClass}
                    style={buttonStyle}
                    // Roving item folded into the expression's single Tab stop
                    // (#257): tabIndex is controller-driven, and in transposition
                    // mode the handle leaves the roving set (toolbar inert).
                    ref={handleRef}
                    tabIndex={handleTabIndex}
                    onKeyDown={(e) => handleRovingKeyDown(e, stack.type)}
                    aria-label={single.label || config.singularLabel}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      if (stack.type !== 'substitute') {
                        setHoverReducePath(path);
                        setHoverReduceIndex(actions.indexOf(single.originalOption as ReducibleActionInfo));
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      if (stack.type !== 'substitute') {
                        setHoverReducePath(null);
                        setHoverReduceIndex(null);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      single.onApply();
                    }}
                  >
                    {buttonInner}
                  </button>
                </Tooltip>
              );
            }

            // Multi-option handle: opens a self-contained hover popover (rendered
            // once, below). Deliberately not a Tooltip, so it's immune to the global
            // single-active-tooltip churn that was dismissing it mid-traversal.
            return (
              <span key={stack.type} className="relative inline-flex">
              <button
                className={buttonClass}
                style={buttonStyle}
                // Roving item folded into the expression's single Tab stop (#257);
                // arrow keys rove, Escape closes the menu or releases focus.
                ref={handleRef}
                tabIndex={handleTabIndex}
                aria-label={`Show ${config.pluralLabel}`}
                aria-haspopup="menu"
                aria-expanded={openMenuType === stack.type}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  // Don't auto-open the option menu on hover while the tree is
                  // mid-slide (#234) — same rationale as the handle tooltips.
                  if (isTreeAnimating) return;
                  openStackMenu(e.currentTarget, stack.type);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  scheduleMenuClose();
                }}
                onClick={(e) => {
                  // Keyboard parity (#231): Enter/Space fire a click, so toggling
                  // the menu here makes the stack operable without a pointer. A
                  // keyboard-activated click reports detail === 0, which routes the
                  // menu into its focus-grabbing modal-style mode (#257, PR D).
                  e.stopPropagation();
                  if (openMenuType === stack.type) {
                    closeMenu();
                  } else {
                    openStackMenu(e.currentTarget, stack.type, e.detail === 0);
                  }
                }}
                onKeyDown={(e) => handleRovingKeyDown(e, stack.type)}
              >
                {buttonInner}
              </button>
              {badge}
              </span>
            );
          })}
          {openMenuType && menuAnchor && typeof document !== 'undefined' && (() => {
            const stack = interactionStacks.find((s) => s.type === openMenuType);
            if (!stack || stack.options.length < 2) return null;
            const config = STACK_CONFIG[stack.type];
            const optionLabelClass = stack.type === 'substitute' ? THEME_GLASS.CHOOSER_OPTION_SUBSTITUTE :
              stack.type === 'reduce' ? THEME_GLASS.CHOOSER_OPTION_SIMPLIFY :
              stack.type === 'distribute' ? THEME_GLASS.CHOOSER_OPTION_DISTRIBUTE :
              THEME_GLASS.CHOOSER_OPTION_IDENTITY;
            // The preview tracks the hovered row; before any hover it stays empty
            // (with a hint) so it never implies a one-click default.
            const previewOption = hoveredOption && hoveredOption.type === stack.type
              ? stack.options[hoveredOption.index]
              : null;
            const headerEl = (
              <span className="font-semibold text-zinc-100 text-xs tracking-wider select-none opacity-85 px-1.5">
                {stack.options.length} {config.pluralLabel} Available
              </span>
            );
            const listEl = (
              <div
                role="menu"
                aria-label={`${stack.options.length} ${config.pluralLabel} available`}
                className="flex flex-col w-full divide-y divide-white/5"
                onMouseLeave={() => setHoveredOption(null)}
              >
                {stack.options.map((opt, i) => (
                  <button
                    key={i}
                    role="menuitem"
                    // Roving cursor within the menu (#257, PR D): exactly one option
                    // is in the tab order; arrows move the active one. Focus is
                    // managed imperatively, so the rest sit at tabIndex -1.
                    ref={(el) => { menuOptionRefs.current[i] = el; }}
                    tabIndex={i === menuActiveIndex ? 0 : -1}
                    onKeyDown={handleMenuKeyDown}
                    className={`w-full min-w-0 text-left px-1.5 py-1.5 flex flex-col gap-0.5 cursor-pointer ${THEME_GLASS.LIST_ITEM_HOVER}`}
                    onMouseEnter={() => {
                      setHoveredOption({ type: stack.type, index: i });
                      if (stack.type !== 'substitute') {
                        setHoverReducePath(path);
                        setHoverReduceIndex(actions.indexOf(opt.originalOption as ReducibleActionInfo));
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      opt.onApply();
                      // closeMenu() clears the hover-grace timer ref; this is an
                      // event handler, not render, so the ref read is safe. The
                      // rule's static analysis can't prove the call site.
                      // eslint-disable-next-line react-hooks/refs
                      closeMenu();
                    }}
                  >
                    <span className={`block truncate leading-snug ${optionLabelClass}`}>{opt.label}</span>
                    {opt.subLabel && <span className={`text-xs leading-snug ${THEME_GLASS.TEXT_MUTED}`}>{opt.subLabel}</span>}
                    {opt.assumptions && opt.assumptions.length > 0 && (
                      <span className={`${THEME_GLASS.TOOLTIP_ASSUMPTION} mt-0.5`}>
                        <TriangleAlert size={11} className={THEME_GLASS.TOOLTIP_ASSUMPTION_ICON} />
                        <span>assuming {opt.assumptions.join(', ')}</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
            const previewEl = (
              <div className="relative w-full">
                <div className={previewOption ? '' : 'invisible'}>
                  <ScaledEquationFit
                    key={`${path}:${openMenuType}`}
                    measureEq={stack.options[0]?.equation ?? null}
                    sizers={stack.options.map((opt, i) => (
                      // Invisible sizers reserve the LARGEST option's size (no hover
                      // reflow) and set the single scale factor.
                      <div key={i} data-testid="preview-sizer" aria-hidden="true" className="invisible col-start-1 row-start-1">
                        {renderEquationPreviewRow(opt.equation, true)}
                      </div>
                    ))}
                  >
                    {previewOption && renderEquationPreviewRow(previewOption.equation, false)}
                  </ScaledEquationFit>
                </div>
                {!previewOption && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none py-3 px-1.5">
                    <span className={`text-sm italic select-none ${THEME_GLASS.TEXT_MUTED}`}>Hover an option to preview</span>
                  </div>
                )}
              </div>
            );

            // Keep the interactive rows nearest the handle so the cursor lands on
            // them, not the preview: menu-above => preview on top; menu-below =>
            // preview on the bottom. The header always hugs the list.
            const placeAbove = menuAnchor.placement === 'above';
            const sections = placeAbove
              ? [previewEl, headerEl, listEl]
              : [headerEl, listEl, previewEl];

            return createPortal(
              <div
                ref={menuContainerRef}
                style={{
                  position: 'fixed',
                  top: `${menuAnchor.top}px`,
                  left: `${menuAnchor.left}px`,
                  transform: placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                  zIndex: 9999,
                }}
                className="relative flex flex-col items-stretch gap-1 py-1.5 px-1 min-w-[210px] max-w-[300px] sm:max-w-[360px] text-left rounded-lg border border-white/10 bg-neutral-950/95 backdrop-blur-md shadow-2xl shadow-[0_0_30px_rgba(129,140,248,0.45)] pointer-events-auto font-sans normal-case"
                onMouseEnter={cancelMenuClose}
                onMouseLeave={scheduleMenuClose}
              >
                {sections.map((section, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <div className="w-full border-t border-white/10 my-1" />}
                    {section}
                  </React.Fragment>
                ))}
              </div>,
              document.body,
            );
          })()}
        </div>
      )}
    </div>
  );

  // Symbol-identification hover hint (#116, #105): a symbol rendered as a Greek
  // glyph (θ) keeps its ASCII spelling in the AST, so we surface its name on hover
  // for osmotic learning; the imaginary unit surfaces its `i = √−1` identification
  // the same way. A bare variable is almost always a *candidate* (it has move
  // handles), so gating on "static" would hide this on nearly every symbol —
  // instead fold the hint into the Select-Term tooltip the node already shows, and
  // fall back to a standalone tip on the rare truly-static symbol.
  const symbolHint =
    node.type === 'SymbolNode' ? symbolHintFor((node as math.SymbolNode).name) : null;
  const symbolHintLabel = symbolHint ? (
    <span className={`text-xs italic select-none ${THEME_GLASS.TEXT_MUTED_BRIGHT}`}>
      {symbolHint}
    </span>
  ) : null;

  // The interaction tooltip that wraps `element`. Whether a node *has* a tooltip
  // (preview-move when it's a drop target, select-term when it's a candidate, or
  // a Greek name label) flips with the async math scan — and a node that gains or
  // loses its <Tooltip> wrapper has `element` re-parented, which remounts the
  // whole operand subtree mid-transform and silently wipes the in-flight FLIP
  // slide (#234). So the wrapper is *always* a <Tooltip> (a stable component type
  // at this position); only its content and visibility vary. A node with nothing
  // to say passes `content={null}` + `visible={false}`, so the wrapper renders
  // but never shows a popover.
  let tooltipContent: React.ReactNode = null;
  // `undefined` = uncontrolled (hover-driven); a boolean = controlled.
  let tooltipVisible: boolean | undefined = false;
  let tooltipClassName = '';

  if (isTarget && targetPaths[path]) {
    const targetEquation = targetPaths[path];
    // Surface the domain restriction the move relies on (e.g. dividing both sides
    // by a variable factor assumes it is non-zero) *before* the user commits it —
    // the same caveat that lands on the resulting connector in the history tree
    // (#63, #103). sourcePath is guaranteed truthy here (isTarget requires it).
    const transpositionAssumptions = sourcePath
      ? describeTransposition(currentEq, sourcePath, path)?.assumptions
      : undefined;
    tooltipContent = (
      <div className="flex flex-col items-center gap-1 py-1 px-0.5 max-w-[280px] sm:max-w-[340px]">
        <span className="font-semibold text-zinc-100 text-xs tracking-wider select-none opacity-80">Preview Move</span>
        {transpositionAssumptions && transpositionAssumptions.length > 0 && (
          <span className={`${THEME_GLASS.TOOLTIP_ASSUMPTION} select-none`}>
            <TriangleAlert size={11} className={THEME_GLASS.TOOLTIP_ASSUMPTION_ICON} />
            <span>assuming {transpositionAssumptions.join(', ')}</span>
          </span>
        )}
        <div className="w-full border-t border-white/10 my-1" />
        <ScaledEquationFit measureEq={targetEquation} className="max-w-[280px] sm:max-w-[340px]">
          {renderEquationPreviewRow(targetEquation, false)}
        </ScaledEquationFit>
      </div>
    );
    tooltipVisible = undefined;
    tooltipClassName = 'max-w-[300px] sm:max-w-[360px]';
  } else if (!sourcePath && isCandidate) {
    tooltipContent = (
      <div className="flex flex-col items-center gap-1 py-1 px-0.5 max-w-[280px] sm:max-w-[340px]">
        <span className="font-semibold text-zinc-100 text-xs tracking-wider select-none opacity-80">Select Term</span>
        <div className="w-full border-t border-white/10 my-1" />
        <ScaledEquationFit className="max-w-[280px] sm:max-w-[340px]">
          <div className="text-[1.3em]"><PreviewEquationNode path={path} /></div>
        </ScaledEquationFit>
        {symbolHintLabel}
      </div>
    );
    tooltipVisible = isHovered && hoverReducePath === null && openMenuType === null;
    tooltipClassName = 'max-w-[300px] sm:max-w-[360px]';
  } else if (symbolHint) {
    // Truly-static identified symbol (no move handles): give the hint its own tip.
    tooltipContent = symbolHint;
    tooltipVisible = undefined;
  }

  const anchored = (
    <Tooltip
      content={tooltipContent}
      position="top"
      // Force-hide while a slide is in flight; otherwise honor the per-case
      // hover/controlled visibility computed above.
      visible={isTreeAnimating ? false : tooltipVisible}
      className={tooltipClassName}
    >
      {element}
    </Tooltip>
  );

  return fillRowHit ? (
    <div className="w-full flex justify-center" onClick={handleNodeClick} data-fill-row-hit>
      {anchored}
    </div>
  ) : (
    anchored
  );
};
