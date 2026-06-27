// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { Tooltip } from './Tooltip';
import { HotkeyHint } from './HotkeyHint';
import { TooltipCard } from './TooltipCard';
import { CopyFormatMenu } from './CopyFormatMenu';
import { equationToString, equationToSpeech, getEquationStatus } from 'math-engine-client';
import { trackEvent } from '../utils/analytics';
import { sentenceCase } from '../utils/text';
import {
  historyTreeAtom,
  currentNodeIdAtom,
  treeLayoutAtom,
  sourcePathAtom,
  hoverPathAtom,
  hoveredLoopTargetIdAtom,
  getCanonicalKey,
  rightSidebarOpenAtom,
  exportPreviewActiveAtom,
  equationToFormat,
  activeZoomModeAtom,
  type VisualTreeNode,
  type HistoryNode,
  type ZoomMode,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { Check, CircleSlash, Infinity, ZoomIn, Search, ZoomOut } from 'lucide-react';
import {
  RovingTabindexProvider,
  useOptionalRovingTabindex,
} from '../hooks/useRovingTabindex';
import { HandleBadge } from './HandleBadge';
import { TransitionTooltipCard } from './TransitionTooltipCard';
import {
  pxToRem,
  laneCardWidth,
  laneX,
  REM_BASE,
  TREE_GUTTER_PX,
  TREE_CARD_HEIGHT_PX,
  TREE_BADGE_SIZE_PX,
  TREE_TOP_OFFSET_PX,
  TREE_ROW_HEIGHT_PX,
  TREE_EMPTY_WIDTH_PX,
  TREE_STANDARD_CONTENT_WIDTH,
  TREE_COLLATERAL_TOLERANCE_PX,
  TREE_LOOP_ARCH_OFFSET_PX,
  TREE_ZOOM_MIN_DIFF_PX,
} from '../utils/treeLayout';
import type { StepChange } from 'math-engine';

// Measure the panel before first paint on the client (so the tree never flashes
// at the fallback width), falling back to a no-op effect during SSR.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

// Shared dashed-flow treatment so the loop connector and the export-path preview
// animate identically (same dash pattern + speed) (#46).
const FLOW_DASH_ARRAY = '5, 5';
const FLOW_DASH_ANIMATION = 'dash 30s linear infinite';

const EDGE_OP_SYMBOLS: Record<string, string> = {
  add: '+',
  subtract: '−',
  multiply: '⋅',
  divide: '/',
  power: '^',
  root: '√',
};

const EDGE_REWRITE_LABELS: Record<string, string> = {
  simplify: 'S',
  distribute: 'D',
  identity: 'I',
  quadratic: 'Q',
  quadratic_standard_form: 'Q',
  substitute: 'S',
  evaluate: 'E',
};

/**
 * The short glyph shown inside a connector's transition handle (#103). Transition
 * badges live on the edge into a node (a property of the *step*), while state
 * badges — contradiction/identity, step index — stay on the node itself. Reads
 * `node.change` when present, falling back to parsing the human label.
 */
const getEdgeBadgeDetails = (
  change: StepChange | undefined,
  label: string,
): { shortLabel: string; isMath: boolean } => {
  if (change) {
    if (change.kind === 'bothSides') {
      return { shortLabel: EDGE_OP_SYMBOLS[change.op] || '', isMath: true };
    }
    if (change.kind === 'rewrite') {
      const shortLabel =
        EDGE_REWRITE_LABELS[change.op] || (change.op ? change.op.charAt(0).toUpperCase() : '');
      return { shortLabel, isMath: false };
    }
  }

  // Fallback: parse the human-readable label when no structured change exists.
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.startsWith('add ')) return { shortLabel: '+', isMath: true };
  if (lowerLabel.startsWith('subtract ')) return { shortLabel: '−', isMath: true };
  if (lowerLabel.startsWith('multiply ')) return { shortLabel: '⋅', isMath: true };
  if (lowerLabel.startsWith('divide ')) return { shortLabel: '/', isMath: true };
  if (lowerLabel === 'swap sides' || lowerLabel.startsWith('swap')) return { shortLabel: '↔', isMath: false };
  if (lowerLabel === 'simplify') return { shortLabel: 'S', isMath: false };
  if (lowerLabel === 'transpose') return { shortLabel: 'T', isMath: false };
  if (lowerLabel === 'substitute') return { shortLabel: 'S', isMath: false };
  if (lowerLabel === 'distribute') return { shortLabel: 'D', isMath: false };
  return { shortLabel: label ? label.charAt(0).toUpperCase() : '', isMath: false };
};

/**
 * Maps a transition to a themed handle accent, or 'neutral' for the glyph
 * handles. The edge icon must match the *handle the user clicked* (#103), so
 * this keys off the handle family, not the engine's finer op classification:
 * the ⚡ Simplify (reduce) handle records its rewrites under several ops —
 * evaluate, simplify, and the quadratic-formula variants — that all map back to
 * the one simplify icon. distribute / identity / substitute are already 1:1.
 */
const getBadgeOpType = (
  change: StepChange | undefined,
  label: string,
): 'simplify' | 'distribute' | 'identity' | 'substitute' | 'neutral' => {
  const op = change?.kind === 'rewrite' ? change.op : label.toLowerCase();
  if (op === 'simplify' || op === 'evaluate' || op === 'quadratic' || op === 'quadratic_standard_form') {
    return 'simplify';
  }
  if (op === 'distribute') return 'distribute';
  if (op === 'identity') return 'identity';
  if (op === 'substitute') return 'substitute';
  return 'neutral';
};

interface WorkspaceTreeViewProps {
  /** When false, the tree is a read-only preview: node clicks don't navigate
   *  and the cards lose their pointer affordance. Defaults to true. */
  interactive?: boolean;
  /** Smoothly scroll the active node into view when it changes. Defaults to true. */
  scrollActiveIntoView?: boolean;
  /** Called after an interactive node selection (e.g. to close a mobile panel). */
  onAfterSelect?: () => void;
  /** Override the scroll-container classes (e.g. a capped height in a modal). */
  className?: string;
}

type PositionedNode = VisualTreeNode & { x: number; y: number; width: number };
type LoopAncestor = { id: string; stepIndex: number; label: string };

interface HistoryStepNodeProps {
  node: PositionedNode;
  loopAncestor: LoopAncestor | undefined;
  stepNum: number;
  cardHeight: number;
  isActive: boolean;
  isCurrent: boolean;
  isLoopHighlight: boolean;
  interactive: boolean;
  exportPreviewActive: boolean;
  activeCardRef: React.MutableRefObject<HTMLDivElement | null>;
  activeCopyMenuNodeId: string | null;
  setActiveCopyMenuNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  tree: Record<string, HistoryNode>;
  childrenByParent: Map<string, string[]>;
  roots: string[];
  onSelect: (id: string) => void;
  onHoverLoop: (id: string | null) => void;
}

/**
 * One step in the history `role="tree"` composite widget (#257).
 *
 * Each step is a `role="treeitem"` (not the old `role="button"` wrapping the copy
 * `<button>`s — that button-in-button nesting is what VoiceOver demoted to
 * "group"). The whole tree is a single Tab stop: the current step is the entry
 * (`primary`), arrow keys rove along the derivation graph — Up/Down to the
 * parent/child step, Left/Right between sibling branches — Enter selects, and
 * `C` copies the focused step (the copy split-button is mouse-only, out of the
 * focus order). Escape releases focus back to the tree container.
 */
const HistoryStepNode: React.FC<HistoryStepNodeProps> = ({
  node,
  loopAncestor,
  stepNum,
  cardHeight,
  isActive,
  isCurrent,
  isLoopHighlight,
  interactive,
  exportPreviewActive,
  activeCardRef,
  activeCopyMenuNodeId,
  setActiveCopyMenuNodeId,
  tree,
  childrenByParent,
  roots,
  onSelect,
  onHoverLoop,
}) => {
  const roving = useOptionalRovingTabindex();
  // Activating a loop bubble jumps to the ancestor it points back to; a regular
  // step selects itself.
  const selectId = loopAncestor ? loopAncestor.id : node.id;

  // Stable ref: registers this step with the roving controller (the current step
  // is `primary`, so it is the tree's default Tab entry) and tracks the current
  // card for scroll-into-view. Mirrors the churn profile of the expression tree's
  // registration (re-created only when the controller or current-ness changes).
  const setNodeRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (roving) {
        if (el) roving.registerItem(node.id, el, { primary: isCurrent });
        else roving.unregisterItem(node.id);
      }
      if (isCurrent) activeCardRef.current = el;
    },
    [roving, node.id, isCurrent, activeCardRef],
  );

  const tabIndex = roving ? (roving.activeKey === node.id ? 0 : -1) : 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    // Keys bubbling up from the copy split-button carry their own handlers.
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        e.stopPropagation();
        onSelect(selectId);
        return;
      case 'c':
      case 'C':
        // Copy reaches the focused step by key, since the copy trigger is out of
        // the focus order (#257). Copies display-ready Unicode (the menu's default).
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard?.writeText(equationToFormat(node.equation, 'unicode'));
        trackEvent({ action: 'copy_step', category: 'history', label: node.id });
        return;
      case 'Escape':
        if (roving) {
          e.preventDefault();
          e.stopPropagation();
          roving.focusContainer();
        }
        return;
    }
    if (!roving) return;
    const move = (id: string | undefined | null) => {
      if (id && id !== node.id) {
        e.preventDefault();
        e.stopPropagation();
        roving.setActive(id, { focus: true });
      }
    };
    switch (e.key) {
      case 'ArrowUp':
        move(tree[node.id]?.parentId);
        break;
      case 'ArrowDown':
        move((childrenByParent.get(node.id) ?? [])[0]);
        break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        const parentId = tree[node.id]?.parentId ?? null;
        const sibs = parentId ? childrenByParent.get(parentId) ?? [node.id] : roots;
        const idx = sibs.indexOf(node.id);
        const nextIdx = e.key === 'ArrowRight' ? Math.min(idx + 1, sibs.length - 1) : Math.max(idx - 1, 0);
        move(sibs[nextIdx]);
        break;
      }
    }
  };

  // Lead with the action (what this step *did*), then read the resulting equation
  // as real spoken math (#256) — "x squared minus 9 equals 0", not the raw symbol
  // string a screen reader would mispronounce. The loop bubble names where it
  // jumps back to.
  const action = node.change?.text ? sentenceCase(node.change.text) : node.label;
  const ariaLabel = loopAncestor
    ? `Loop back to step ${loopAncestor.stepIndex} (${loopAncestor.label})`
    : `Step ${stepNum}: ${action}. ${equationToSpeech(node.equation)}`;

  const interactiveProps = interactive
    ? {
        role: 'treeitem' as const,
        tabIndex,
        // aria-selected is the tree's selection state; aria-current="step" marks
        // the user's position in the derivation. Both ride on the same node.
        'aria-selected': isCurrent,
        'aria-current': isCurrent ? ('step' as const) : undefined,
        'aria-keyshortcuts': 'C',
        'aria-label': ariaLabel,
        onKeyDown: handleKeyDown,
      }
    : {};

  if (loopAncestor) {
    // Render Compact Loop Terminal Bubble!
    return (
      <Tooltip
        position="right"
        delay={300} // Snappy but deliberate 300ms hover delay to prevent jitter
        wrapperClassName="z-10 absolute"
        style={{
          left: pxToRem(node.x + (node.width - TREE_BADGE_SIZE_PX) / 2), // Center the bubble in the column
          top: pxToRem(node.y),
          width: pxToRem(TREE_BADGE_SIZE_PX),
          height: pxToRem(cardHeight),
        }}
        className="w-56 p-3 z-50 text-left lowercase-none normal-case flex flex-col gap-1.5 pointer-events-auto"
        content={
          <div className="flex flex-col gap-0.5 text-fuchsia-300 font-semibold p-1">
            <div className="flex items-center gap-1 tracking-wider text-[0.5rem] font-bold text-fuchsia-400">
              <Infinity size={10} />
              <span>Loop Detected</span>
            </div>
            <div className="text-xs lowercase-none normal-case leading-tight">
              This action leads back to <strong>Step {loopAncestor.stepIndex} ({loopAncestor.label})</strong>.
            </div>
            <div className={`text-[0.5625rem] ${THEME_GLASS.TEXT_MUTED} mt-1 italic`}>
              Click to select and return to Step {loopAncestor.stepIndex}.
            </div>
          </div>
        }
      >
        <div
          ref={setNodeRef}
          onClick={() => onSelect(selectId)} // Selects and jumps back to the original ancestor!
          {...interactiveProps}
          onMouseEnter={() => onHoverLoop(loopAncestor.id)}
          onMouseLeave={() => onHoverLoop(null)}
          className={`w-11 h-11 rounded-full flex items-center justify-center border select-none transition-all duration-300 relative group/node ${THEME_GLASS.NODE_FOCUS_RING} ${
            isLoopHighlight
              ? THEME_GLASS.LOOP_NODE_ACTIVE
              : THEME_GLASS.LOOP_NODE_DEFAULT
          } ${interactive ? '' : 'cursor-default'}`}
        >
          {/* Step index badge on top-left */}
          <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[0.5rem] flex items-center justify-center font-bold shadow transition-all duration-300 ${
            isLoopHighlight
              ? THEME_GLASS.TREE_NODE_BADGE_LOOP
              : 'bg-fuchsia-950 border-fuchsia-500/30 text-fuchsia-400'
          }`}>
            {stepNum}
          </span>

          {/* Infinite Loop Icon in Center */}
          <Infinity size={18} className="stroke-[2.5]" />
        </div>
      </Tooltip>
    );
  }

  // Only *state* badges live on the node now (#103): the contradiction/identity
  // status is a pure function of this node's equation, so it pins to the
  // top-right corner. Transition badges (substitute #3, restriction #63) moved
  // onto the incoming connector — they describe the step, not the state.
  const eqStatus = getEquationStatus(node.equation);
  const isContradiction = eqStatus === 'contradiction';
  const isIdentity = eqStatus === 'identity';

  return (
    <Tooltip
      position="right"
      delay={300} // Snappy but deliberate 300ms hover delay to prevent jitter
      visible={activeCopyMenuNodeId === node.id ? false : undefined}
      // Each node wrapper is its own stacking context (z-10), so the copy
      // dropdown's z-50 only outranks content *within* this node — later
      // sibling nodes (steps below) would paint over it. Lift the active
      // node above its siblings while hovered/focused so its menu floats free.
      wrapperClassName="z-10 absolute hover:z-30 focus-within:z-30"
      style={{
        left: pxToRem(node.x),
        top: pxToRem(node.y),
        width: pxToRem(node.width),
        height: pxToRem(cardHeight),
      }}
      className={`max-w-[85vw] w-max p-4 z-50 text-left lowercase-none normal-case flex flex-col gap-2 pointer-events-auto font-sans ${THEME_GLASS.TOOLTIP_DETAILS}`}
      content={
        <TooltipCard
          eyebrow={stepNum === 0 ? 'Initial state' : `Step ${stepNum}`}
          meta={isCurrent ? 'Active step' : undefined}
          equation={node.equation}
        />
      }
    >
      <div
        ref={setNodeRef}
        onClick={() => onSelect(node.id)}
        {...interactiveProps}
        onMouseEnter={() => onHoverLoop(node.id)}
        onMouseLeave={() => onHoverLoop(null)}
        className={`w-full h-full rounded-xl flex flex-col items-center justify-center border select-none transition-all duration-300 relative group/node ${THEME_GLASS.NODE_FOCUS_RING} ${
          isLoopHighlight
            ? THEME_GLASS.TREE_NODE_LOOP
            : isCurrent
            ? THEME_GLASS.TREE_NODE_ACTIVE
            : THEME_GLASS.TREE_NODE_DEFAULT
        } ${exportPreviewActive && !isActive ? THEME_GLASS.COPY_PREVIEW_DIMMED : ''} ${interactive ? '' : 'cursor-default'}`}
      >
        {/* Step index badge on top-left */}
        <span className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border text-[0.5rem] flex items-center justify-center font-bold shadow transition-all duration-300 ${
          isLoopHighlight
            ? THEME_GLASS.TREE_NODE_BADGE_LOOP
            : isCurrent
            ? THEME_GLASS.TREE_NODE_BADGE_ACTIVE
            : THEME_GLASS.TREE_NODE_BADGE_DEFAULT
        }`}>
          {stepNum}
        </span>

        {/* Contradiction / identity badge (#92): flags terminal states
            that collapsed to a constant relation — a contradiction
            (e.g. 3 = -3, no solution) or an identity (e.g. 0 = 0,
            always true). A pure function of this node's equation, so it
            stays on the node (the lone state badge in the top-right corner);
            transition badges moved to the connectors (#103). */}
        {(isContradiction || isIdentity) && (
          <Tooltip
            content={isContradiction
              ? 'Contradiction — this statement is false, so there is no solution'
              : 'Identity — this statement is always true'}
            position="top"
            className="w-max max-w-[240px] text-center text-sm"
            wrapperClassName="z-20 absolute -top-1.5 -right-1.5"
          >
            <span className={`h-4 w-4 rounded-full border text-[0.5rem] flex items-center justify-center shadow transition-all duration-300 ${isContradiction ? THEME_GLASS.TREE_NODE_BADGE_CONTRADICTION : THEME_GLASS.TREE_NODE_BADGE_IDENTITY}`}>
              {isContradiction ? <CircleSlash size={9} /> : <Check size={9} />}
            </span>
          </Tooltip>
        )}

        {/* Truncated Equation Label. Asymmetric padding (#279): the right side
            still clears the copy split-button toolbar (`pr-10`), but the left
            only needs to clear the rounded corner — the step-index and
            contradiction/identity badges sit at negative offsets *outside* the
            card, so they buy no internal clearance. Slimming the left reclaims
            width so the equation truncates less on narrow cards. */}
        <span className={`text-xs font-mono truncate max-w-full text-indigo-50 font-semibold text-center ${interactive ? 'pl-3 pr-10' : 'px-2'}`}>
          {equationToString(node.equation)}
        </span>

        {/* Hover Actions Toolbar — omitted in read-only preview mode
            (e.g. the Feedback modal), where copying a step isn't useful. */}
        {interactive && (
          // Rests clearly visible (not at the faint contextual-actions
          // opacity) and brightens to full on node hover (#243).
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center opacity-70 group-hover/node:opacity-100 transition-opacity duration-300 z-20">
            {/* The `C E` hotkey copies the *current* step only, so the
                keycap hint would mislead on any other node — show the
                plain label there. The split-button is mouse-only here: keyboard
                copies the focused step with the advertised C shortcut (#257). */}
            <CopyFormatMenu
              getText={(format) => equationToFormat(node.equation, format)}
              iconSize={11}
              variant="tree"
              focusable={false}
              tooltip={isCurrent ? <HotkeyHint label="Copy equation" sequence={['C', 'E']} /> : 'Copy equation'}
              tooltipPosition="top"
              trackAction="copy_step"
              trackCategory="history"
              trackLabel={node.id}
              scopeLabel="This step"
              scopeEquation={node.equation}
              stopPropagation
              onOpenChange={(isOpen) => {
                if (isOpen) {
                  setActiveCopyMenuNodeId(node.id);
                } else {
                  setActiveCopyMenuNodeId((current) => current === node.id ? null : current);
                }
              }}
            />
          </div>
        )}
      </div>
    </Tooltip>
  );
};

/**
 * The workspace derivation graph — the SVG-connected node tree shown in the
 * History panel. Reads the live workspace atoms, so every mount renders the same
 * current derivation; pass `interactive={false}` for a read-only preview (used by
 * the Feedback modal so the user sees exactly what a `?ws=` link would share).
 */
export const WorkspaceTreeView: React.FC<WorkspaceTreeViewProps> = ({
  interactive = true,
  scrollActiveIntoView = true,
  onAfterSelect,
  className,
}) => {
  const [tree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const setSourcePath = useSetAtom(sourcePathAtom);
  const setHoverPath = useSetAtom(hoverPathAtom);
  const setRightSidebarOpen = useSetAtom(rightSidebarOpenAtom);
  const layout = useAtomValue(treeLayoutAtom);
  const [hoveredLoopTargetId, setHoveredLoopTargetId] = useAtom(hoveredLoopTargetIdAtom);
  const exportPreviewActive = useAtomValue(exportPreviewActiveAtom);
  const [activeCopyMenuNodeId, setActiveCopyMenuNodeId] = React.useState<string | null>(null);

  const activeCardRef = React.useRef<HTMLDivElement | null>(null);
  // The role="tree" container; Escape on a step releases focus back here (#257).
  const treeContainerRef = React.useRef<HTMLDivElement | null>(null);
  // The scrollable panel wrapping the tree drives the row layout so the cards
  // fill it with symmetric gutters (#279). The width is held in *design units*
  // (rem × REM_BASE), not raw px: the panel is sized in rem (lg:w-80 = 20rem), so
  // its px width already grows with the text-size knob. Dividing the measured px
  // back down by the live root font-size yields a font-invariant design width,
  // which pxToRem then re-scales exactly once — measuring px directly would
  // double-scale and overflow the panel as the knob grows the font. Falls back to
  // 240 until the first measurement, matching the SSR + initial client render so
  // hydration stays stable.
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [zoomMode, setZoomMode] = useAtom(activeZoomModeAtom);

  const handleZoomChange = (mode: ZoomMode) => {
    setZoomMode(mode);
    trackEvent({
      action: 'select_zoom',
      category: 'history',
      label: mode,
    });
  };
  const [containerWidth, setContainerWidth] = React.useState(240);
  const [containerHeight, setContainerHeight] = React.useState(400);
  const lastContainerWidthRef = React.useRef(0);
  const lastContainerHeightRef = React.useRef(0);

  useIsomorphicLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const contentPx =
        el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
      const contentHeightPx =
        el.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0');
      if (contentPx <= 0 || contentHeightPx <= 0) return;
      const rootFontPx =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_BASE;
      const design = (contentPx * REM_BASE) / rootFontPx;
      const designHeight = (contentHeightPx * REM_BASE) / rootFontPx;
      // Guard against ResizeObserver feedback from sub-pixel jitter (and from the
      // knob, which moves px and font together so the design width holds steady).
      if (Math.abs(design - lastContainerWidthRef.current) < 0.5 &&
          Math.abs(designHeight - lastContainerHeightRef.current) < 0.5) return;
      lastContainerWidthRef.current = design;
      lastContainerHeightRef.current = designHeight;
      setContainerWidth(design);
      setContainerHeight(designHeight);
    };
    // Measure synchronously before the first paint so the cards never flash at
    // the 240 fallback width and then resize into place (#279).
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!scrollActiveIntoView) return;
    const timer = setTimeout(() => {
      if (activeCardRef.current) {
        activeCardRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentNodeId, scrollActiveIntoView, zoomMode, containerWidth, containerHeight]);

  const handleStepClick = (id: string) => {
    if (!interactive) return;
    setCurrentNodeId(id);
    trackEvent({
      action: 'select_step',
      category: 'history',
      label: id,
    });
    setSourcePath(null);
    setHoverPath(null);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setRightSidebarOpen(false);
    }
    onAfterSelect?.();
  };

  // Compute permanent chronological indices for visual rendering
  const sortedNodes = React.useMemo(() => {
    return Object.values(tree).sort((a, b) => a.timestamp - b.timestamp);
  }, [tree]);

  const stepIndices = React.useMemo(() => {
    const indices = new Map<string, number>();
    sortedNodes.forEach((n, idx) => indices.set(n.id, idx));
    return indices;
  }, [sortedNodes]);

  const layoutNodes = Object.values(layout);

  // Heuristic Loop Detection: Map each nodeId to the earliest canonically equivalent ancestor node (if a loop exists)
  const loopAncestorMap = React.useMemo(() => {
    const map = new Map<string, { id: string; stepIndex: number; label: string }>();

    layoutNodes.forEach((node) => {
      const nodeIdx = stepIndices.get(node.id) ?? 0;
      const nodeCanonical = getCanonicalKey(node.equation);

      // Find the earliest node in the tree that is canonically equivalent to this node
      let earliestNode: typeof sortedNodes[0] | null = null;
      let earliestIdx = nodeIdx;

      for (const otherNode of sortedNodes) {
        if (otherNode.id === node.id) continue;
        const otherIdx = stepIndices.get(otherNode.id) ?? 0;
        if (otherIdx < earliestIdx) {
          if (getCanonicalKey(otherNode.equation) === nodeCanonical) {
            earliestIdx = otherIdx;
            earliestNode = otherNode;
          }
        }
      }

      if (earliestNode) {
        map.set(node.id, {
          id: earliestNode.id,
          stepIndex: earliestIdx,
          label: earliestNode.label,
        });
      }
    });

    return map;
  }, [sortedNodes, stepIndices, layoutNodes]);

  const maxDepth = Math.max(...layoutNodes.map(n => n.depth), 0);
  const cardHeight = TREE_CARD_HEIGHT_PX;

  // Position each card from its lane (#304): a fixed, row-independent width and a
  // column-driven x, so a branch descends in a straight vertical line and a wide
  // tree scrolls horizontally rather than re-packing each row across the panel.
  const visualNodes = React.useMemo(() => {
    const cardWidth = laneCardWidth(TREE_STANDARD_CONTENT_WIDTH);
    return layoutNodes.map(node => ({
      ...node,
      x: laneX(node.column, cardWidth),
      y: TREE_TOP_OFFSET_PX + node.depth * TREE_ROW_HEIGHT_PX,
      width: cardWidth,
    }));
  }, [layoutNodes]);

  const visualNodesMap = React.useMemo(() => {
    const map: Record<string, typeof visualNodes[0]> = {};
    visualNodes.forEach(n => map[n.id] = n);
    return map;
  }, [visualNodes]);

  // Sibling ordering for keyboard roving (#257): children of each parent (and the
  // roots) in left-to-right visual order, so ArrowLeft/Right step between branches
  // as they appear, and ArrowDown lands on the leftmost child.
  const { childrenByParent, roots } = React.useMemo(() => {
    const byParent = new Map<string, string[]>();
    const rootList: typeof visualNodes = [];
    const groups = new Map<string, typeof visualNodes>();
    visualNodes.forEach((n) => {
      if (n.parentId === null) {
        rootList.push(n);
      } else {
        const arr = groups.get(n.parentId) ?? [];
        arr.push(n);
        groups.set(n.parentId, arr);
      }
    });
    groups.forEach((arr, parentId) => {
      byParent.set(parentId, [...arr].sort((a, b) => a.x - b.x).map((n) => n.id));
    });
    return {
      childrenByParent: byParent,
      roots: [...rootList].sort((a, b) => a.x - b.x).map((n) => n.id),
    };
  }, [visualNodes]);

  // SVG grid sizing
  const svgWidth = React.useMemo(() => {
    if (visualNodes.length === 0) return TREE_EMPTY_WIDTH_PX;
    const maxRight = Math.max(...visualNodes.map(n => n.x + n.width));
    return maxRight + TREE_GUTTER_PX; // mirror the left gutter on the right
  }, [visualNodes]);

  const svgHeight = TREE_TOP_OFFSET_PX * 2 + maxDepth * TREE_ROW_HEIGHT_PX + cardHeight;

  // Compute Zoom Scale Factor
  const zoomScale = React.useMemo(() => {
    if (zoomMode === 'fit-width') {
      const diff = svgWidth - containerWidth;
      return diff <= TREE_ZOOM_MIN_DIFF_PX ? 1.0 : Math.min(1.0, containerWidth / svgWidth);
    }
    if (zoomMode === 'full-tree') {
      const widthDiff = svgWidth - containerWidth;
      const heightDiff = svgHeight - containerHeight;
      // Zoom out only if there is a meaningful overflow in either direction
      const wScale = widthDiff <= TREE_ZOOM_MIN_DIFF_PX ? 1.0 : containerWidth / svgWidth;
      const hScale = heightDiff <= TREE_ZOOM_MIN_DIFF_PX ? 1.0 : containerHeight / svgHeight;
      return Math.min(1.0, wScale, hScale);
    }
    return 1.0;
  }, [zoomMode, containerWidth, containerHeight, svgWidth, svgHeight]);

  // Compute the path of ancestor node IDs from the root up to the active node pointer
  const activePathSet = React.useMemo(() => {
    const pathSet = new Set<string>();
    let currentId: string | null = currentNodeId;
    while (currentId !== null) {
      pathSet.add(currentId);
      currentId = tree[currentId]?.parentId ?? null;
    }
    return pathSet;
  }, [tree, currentNodeId]);

  // Build the link connections
  const connections = React.useMemo(() => {
    const links: {
      parent: { x: number; y: number; width: number; id: string };
      child: { x: number; y: number; width: number; id: string; isActive: boolean };
      // Midpoint of the cubic connector. The control points are vertically
      // symmetric about the endpoints, so the curve's t=0.5 point is exactly the
      // average of the parent's bottom-center and the child's top-center — the
      // anchor for the edge's transition handle (#103).
      xMid: number;
      yMid: number;
    }[] = [];
    visualNodes.forEach((node) => {
      if (node.parentId !== null && visualNodesMap[node.parentId]) {
        const parent = visualNodesMap[node.parentId];
        const isActiveLink = activePathSet.has(parent.id) && activePathSet.has(node.id);
        const startX = parent.x + parent.width / 2;
        const startY = parent.y + cardHeight;
        const endX = node.x + node.width / 2;
        const endY = node.y;
        links.push({
          parent: { x: parent.x, y: parent.y, width: parent.width, id: parent.id },
          child: { x: node.x, y: node.y, width: node.width, id: node.id, isActive: isActiveLink },
          xMid: (startX + endX) / 2,
          yMid: (startY + endY) / 2,
        });
      }
    });
    return links;
  }, [visualNodes, visualNodesMap, activePathSet, cardHeight]);

  // The derivation graph as a single composite widget (#257): one Tab stop on the
  // role="tree" container, arrow keys rove between steps (Up/Down = parent/child,
  // Left/Right = sibling branches). Read-only previews skip the tree semantics.
  const canvas = (
      <div
        ref={treeContainerRef}
        {...(interactive
          ? { role: 'tree' as const, 'aria-label': 'Derivation history', tabIndex: -1 }
          : {})}
        style={{
          width: pxToRem(svgWidth),
          height: pxToRem(svgHeight),
          transform: `scale(${zoomScale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        className={interactive ? 'outline-none' : ''}
      >
        {/* SVG Connection Lines (decorative — hidden from the a11y tree so the
            tree's required children stay valid). The curves are drawn in the px
            coordinate space the layout is computed in; the px `viewBox` maps that
            space onto the rem-rendered box so the lines track the rem-positioned
            cards as the root font-size scales the whole tree (#279). */}
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: pxToRem(svgWidth), height: pxToRem(svgHeight) }}
          className="absolute inset-0 pointer-events-none z-0"
        >
          <style>{`
            @keyframes dash {
              to {
                stroke-dashoffset: -1000;
              }
            }
          `}</style>
          {connections.map(({ parent, child }) => {
            // Connect parent bottom-center to child top-center dynamically
            const startX = parent.x + parent.width / 2;
            const startY = parent.y + cardHeight;
            const endX = child.x + child.width / 2;
            const endY = child.y;

            const cp1y = startY + (endY - startY) * 0.45;
            const cp2y = startY + (endY - startY) * 0.55;

            const d = `M ${startX} ${startY} C ${startX} ${cp1y}, ${endX} ${cp2y}, ${endX} ${endY}`;
            // While hovering a full-derivation copy trigger, animate the active
            // path edges with a downward-flowing dash (reusing the loop's `dash`
            // keyframe) to show direction of travel root -> selected (#46, opt B).
            const isPreviewPath = exportPreviewActive && child.isActive;
            return (
              <path
                key={`${parent.id}-${child.id}`}
                d={d}
                fill="none"
                stroke={isPreviewPath ? "rgba(165, 180, 252, 0.95)" : child.isActive ? "rgba(129, 140, 248, 0.6)" : "rgba(255, 255, 255, 0.12)"}
                strokeWidth={isPreviewPath ? 3 : child.isActive ? 2.5 : 1.5}
                strokeDasharray={isPreviewPath ? FLOW_DASH_ARRAY : undefined}
                strokeLinecap="round"
                className="transition-all duration-300"
                style={isPreviewPath ? { animation: FLOW_DASH_ANIMATION } : undefined}
              />
            );
          })}

          {/* Dynamic loop-connecting dashed line (Echo high-fidelity curve) */}
          {hoveredLoopTargetId && visualNodes.map(node => {
            const loopAncestor = loopAncestorMap.get(node.id);
            if (loopAncestor && hoveredLoopTargetId === loopAncestor.id) {
              const ancestor = visualNodesMap[loopAncestor.id];
              if (ancestor) {
                let startX = 0;
                let startY = 0;
                let endX = 0;
                let endY = 0;
                let cp1x = 0;
                let cp1y = 0;
                let cp2x = 0;
                let cp2y = 0;

                const isCollateral = Math.abs(ancestor.y - node.y) < TREE_COLLATERAL_TOLERANCE_PX;
                const isAncestorAbove = ancestor.y < node.y;

                if (isCollateral) {
                  const inBetweenNodes = visualNodes.filter(n =>
                    n.id !== ancestor.id &&
                    n.id !== node.id &&
                    Math.abs(n.y - ancestor.y) < TREE_COLLATERAL_TOLERANCE_PX &&
                    n.x > Math.min(ancestor.x, node.x) &&
                    n.x < Math.max(ancestor.x, node.x)
                  );
                  const hasObstacle = inBetweenNodes.length > 0;
                  const archOffset = hasObstacle ? TREE_LOOP_ARCH_OFFSET_PX : 0;

                  if (ancestor.x < node.x) {
                    startX = node.x + (node.width - TREE_BADGE_SIZE_PX) / 2;
                    startY = node.y + cardHeight / 2;
                    endX = ancestor.x + ancestor.width;
                    endY = ancestor.y + cardHeight / 2;
                  } else {
                    startX = node.x + (node.width + TREE_BADGE_SIZE_PX) / 2;
                    startY = node.y + cardHeight / 2;
                    endX = ancestor.x;
                    endY = ancestor.y + cardHeight / 2;
                  }

                  cp1x = startX + (endX - startX) * 0.45;
                  cp1y = startY - archOffset;
                  cp2x = startX + (endX - startX) * 0.55;
                  cp2y = endY - archOffset;
                } else if (isAncestorAbove) {
                  startX = node.x + node.width / 2;
                  startY = node.y;
                  endX = ancestor.x + ancestor.width / 2;
                  endY = ancestor.y + cardHeight;

                  cp1x = startX;
                  cp1y = startY + (endY - startY) * 0.45;
                  cp2x = endX;
                  cp2y = startY + (endY - startY) * 0.55;
                } else {
                  startX = node.x + node.width / 2;
                  startY = node.y + cardHeight;
                  endX = ancestor.x + ancestor.width / 2;
                  endY = ancestor.y;

                  cp1x = startX;
                  cp1y = startY + (endY - startY) * 0.45;
                  cp2x = endX;
                  cp2y = startY + (endY - startY) * 0.55;
                }

                const dStr = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

                return (
                  <path
                    key={`loop-${ancestor.id}-${node.id}`}
                    d={dStr}
                    fill="none"
                    stroke={THEME_GLASS.LOOP_LINE_STROKE}
                    strokeWidth={2.5}
                    strokeDasharray={FLOW_DASH_ARRAY}
                    className="transition-all duration-300 animate-dash"
                    style={{
                      animation: FLOW_DASH_ANIMATION,
                    }}
                  />
                );
              }
            }
            return null;
          })}
        </svg>

        {/* Edge Transition Handles (#103) — the transition that produced each
            child rides on its incoming connector (a property of the *step*),
            not the node corner. Anchored to the curve midpoint. Decorative for
            assistive tech (aria-hidden, kept out of the tree's roving focus
            order): the child treeitem's accessible name already carries the
            action + spoken equation, so the handle is a sighted-mouse affordance
            and must not add a second Tab stop or an invalid non-treeitem child. */}
        {connections.map(({ parent, child, xMid, yMid }) => {
          const node = tree[child.id];
          if (!node) return null;

          const { shortLabel, isMath } = getEdgeBadgeDetails(node.change, node.label);
          const opType = getBadgeOpType(node.change, node.label);
          const hasRestrictionBadge = !!node.change?.assumptions?.length;
          const isHighlighted = hoveredLoopTargetId === node.id;
          const parentStepNum = stepIndices.get(parent.id) ?? 0;
          const childStepNum = stepIndices.get(child.id) ?? 0;

          return (
            <Tooltip
              key={`edge-handle-${node.id}`}
              position="top"
              className={`max-w-[85vw] w-max p-4 z-50 text-left lowercase-none normal-case flex flex-col gap-2 pointer-events-auto font-sans ${THEME_GLASS.TOOLTIP_DETAILS}`}
              wrapperClassName="absolute pointer-events-auto z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: pxToRem(xMid), top: pxToRem(yMid) }}
              content={
                <TransitionTooltipCard
                  parentStepNum={parentStepNum}
                  childStepNum={childStepNum}
                  description={node.change?.text || node.label}
                  change={node.change}
                  assumptions={node.change?.assumptions}
                />
              }
            >
              <HandleBadge
                opType={opType}
                hasRestrictionBadge={hasRestrictionBadge}
                shortLabel={shortLabel}
                isMath={isMath}
                isHighlighted={isHighlighted}
                aria-hidden
                tabIndex={-1}
                className={interactive ? '' : 'cursor-default'}
                onClick={
                  interactive
                    ? (e) => {
                        e.stopPropagation();
                        handleStepClick(node.id);
                      }
                    : undefined
                }
              />
            </Tooltip>
          );
        })}

        {/* Tree Node Bubbles */}
        {visualNodes.map((node) => {
          const loopAncestor = loopAncestorMap.get(node.id);
          return (
            <HistoryStepNode
              key={node.id}
              node={node}
              loopAncestor={loopAncestor}
              stepNum={stepIndices.get(node.id) ?? 0}
              cardHeight={cardHeight}
              isActive={activePathSet.has(node.id)}
              isCurrent={currentNodeId === node.id}
              isLoopHighlight={hoveredLoopTargetId === node.id || (!!loopAncestor && hoveredLoopTargetId === loopAncestor.id)}
              interactive={interactive}
              exportPreviewActive={exportPreviewActive}
              activeCardRef={activeCardRef}
              activeCopyMenuNodeId={activeCopyMenuNodeId}
              setActiveCopyMenuNodeId={setActiveCopyMenuNodeId}
              tree={tree}
              childrenByParent={childrenByParent}
              roots={roots}
              onSelect={handleStepClick}
              onHoverLoop={setHoveredLoopTargetId}
            />
          );
        })}
      </div>
  );

  const scaledWrapper = (
    <div
      style={
        interactive
          ? {
              width: pxToRem(svgWidth * zoomScale),
              height: pxToRem(svgHeight * zoomScale),
              position: 'relative',
              overflow: 'hidden',
              minWidth: '100%',
            }
          : {
              width: pxToRem(svgWidth * zoomScale),
              height: pxToRem(svgHeight * zoomScale),
              position: 'relative',
              overflow: 'hidden',
            }
      }
      className={interactive ? 'relative' : 'relative mx-auto'}
    >
      {canvas}
    </div>
  );

  if (!interactive) {
    return (
      <div ref={scrollContainerRef} className={className ?? `flex-1 overflow-auto pr-1 relative ${THEME_GLASS.TREE_BG}`}>
        {scaledWrapper}
      </div>
    );
  }

  return (
    <div className={`relative flex-1 flex flex-col min-h-0 group ${className ?? THEME_GLASS.TREE_BG}`}>
      <div className="absolute top-3 right-4 z-30 contextual-actions flex items-center gap-1.5">
        <Tooltip content={<HotkeyHint label="Zoom: Normal" keys="Z" />} position="bottom">
          <button
            onClick={() => handleZoomChange('normal')}
            className={zoomMode === 'normal' ? THEME_GLASS.ICON_BUTTON_ACTIVE : THEME_GLASS.ICON_BUTTON}
            aria-label="Zoom: Normal"
          >
            <ZoomIn size={14} />
          </button>
        </Tooltip>
        <Tooltip content={<HotkeyHint label="Zoom: Fit Width" keys="Z" />} position="bottom">
          <button
            onClick={() => handleZoomChange('fit-width')}
            className={zoomMode === 'fit-width' ? THEME_GLASS.ICON_BUTTON_ACTIVE : THEME_GLASS.ICON_BUTTON}
            aria-label="Zoom: Fit Width"
          >
            <Search size={14} />
          </button>
        </Tooltip>
        <Tooltip content={<HotkeyHint label="Zoom: Full Tree" keys="Z" />} position="bottom">
          <button
            onClick={() => handleZoomChange('full-tree')}
            className={zoomMode === 'full-tree' ? THEME_GLASS.ICON_BUTTON_ACTIVE : THEME_GLASS.ICON_BUTTON}
            aria-label="Zoom: Full Tree"
          >
            <ZoomOut size={14} />
          </button>
        </Tooltip>
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-auto pr-1 pt-9 relative rounded-2xl">
        <RovingTabindexProvider containerRef={treeContainerRef}>{scaledWrapper}</RovingTabindexProvider>
      </div>
    </div>
  );
};
