// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { EquationNode } from '../components/EquationNode';
import { ActiveRestrictionsCaveat } from '../components/ActiveRestrictionsCaveat';
import { TerminalStateCaveat } from '../components/TerminalStateCaveat';
import { Sidebar, SidebarContent, EquationLibraryContent } from '../components/Sidebar';
import { ControlPanel } from '../components/ControlPanel';
import { GraphPanel } from '../components/GraphPanel';
import { FeedbackModal } from '../components/FeedbackModal';
import { DeleteWorkspaceModal } from '../components/DeleteWorkspaceModal';
import { ResetHistoryModal } from '../components/ResetHistoryModal';
import { EquationInputModal } from '../components/EquationInputModal';
import { SettingsModal } from '../components/SettingsModal';
import { ExportWorkspacesModal } from '../components/ExportWorkspacesModal';
import { ImportWorkspacesModal } from '../components/ImportWorkspacesModal';
import { AboutModal } from '../components/AboutModal';
import { OnboardingTour } from '../components/OnboardingTour';
import { DragNudgeHint } from '../components/DragNudgeHint';
import { Tooltip } from '../components/Tooltip';
import { HotkeyHint } from '../components/HotkeyHint';
import { WorkspaceTabs } from '../components/WorkspaceTabs';
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher';
import { SkipLinks } from '../components/SkipLinks';
import { RovingTabindexProvider } from '../hooks/useRovingTabindex';
import { useAncestorFocusBridge } from '../hooks/useAncestorFocusBridge';
import { ExploreEquationTree } from '../components/ExploreEquationTree';
import { ShareMenu } from '../components/ShareMenu';
import { HeaderOverflowMenu } from '../components/HeaderOverflowMenu';
import { SharedWorkspaceBanner } from '../components/SharedWorkspaceBanner';
import { StorageDegradedBanner } from '../components/StorageDegradedBanner';
import {
  sharedWorkspaceBannerAtom,
  isSharedWorkspaceBannerDismissed,
} from '../store/sharedWorkspaceBanner';
import { FactsStrip } from '../components/FactsStrip';
import { BottomNav } from '../components/BottomNav';
import { BottomSheet } from '../components/BottomSheet';
import { RadialMenu } from '../components/RadialMenu';
import { ImmersiveToggle } from '../components/ImmersiveToggle';
import { PeekHandle } from '../components/PeekHandle';
import { useIsMobile } from '../hooks/useBreakpoint';
import { useIsShortScreen, useIsVeryShortScreen } from '../hooks/useIsShortScreen';
import { useImmersiveChrome } from '../hooks/useImmersiveChrome';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useKeyboardShortcuts, ShortcutConfig } from '../hooks/useKeyboardShortcuts';
import { SHORTCUT_CATALOG, ShortcutId } from '../constants/shortcutCatalog';
import { useClipboardBridge } from '../hooks/useClipboardBridge';
import { ShortcutsOverlay } from '../components/ShortcutsOverlay';
import { HelpModal } from '../components/HelpModal';
import { decodeEqParam } from '../utils/eqParam';
import { consumePendingShare, resolveInitialWsSource, createShareLink } from '../utils/shareLink';
import { safeCopyText } from '../utils/clipboard';
import {
  currentEquationAtom,
  liveAnnouncementAtom,
  navReadoutAtom,
  explorationModeAtom,
  treeRefocusNonceAtom,
  candidatePathsAtom,
  hoverPathAtom,
  targetPathsAtom,
  reduciblePathsAtom,
  sourcePathAtom,
  syncMathStateAtom,
  clearMathStateAtom,
  historyTreeAtom,
  currentNodeIdAtom,
  HistoryNode,
  savedSessionsAtom,
  currentSessionIdAtom,
  SavedSession,
  SerializedHistoryNode,
  serializeTree,
  deserializeTree,
  serializeWorkspaceState,
  type ShareScope,
  deminifyWorkspace,
  deminifyReplayWorkspace,
  SUPPORTED_WS_REPLAY_VERSIONS,
  SUPPORTED_SCHEMA_VERSIONS,
  wrapVersioned,
  unwrapVersioned,
  getActivePathIds,
  INITIAL_EQUATION_STRING,
  leftSidebarOpenAtom,
  rightSidebarOpenAtom,
  feedbackModalOpenAtom,
  feedbackContextAtom,
  settingsModalOpenAtom,
  exportWorkspacesModalOpenAtom,
  importWorkspacesModalOpenAtom,
  mathLoadingAtom,
  isTreeAnimatingAtom,
  hydrateWorkspaceTabsAtom,
  appHydratedAtom,
  toastAtom,
  createNewSessionAtom,
  createSessionFromStateAtom,
  currentTabNameAtom,
  deleteConfirmationModalOpenAtom,
  resetHistoryModalOpenAtom,
  tabsAtom,
  activeTabIdAtom,
  activeBottomSheetAtom,
  radialMenuOpenAtom,
  radialInitialActionAtom,
  RadialInitialAction,
  swapSidesAtom,
  addTabAtom,
  onboardingChapterIdAtom,
  onboardingGlobalOpAtom,
  graphSizeAtom,
  previousGraphSizeAtom,
  rightSidebarSizeAtom,
  previousRightSidebarSizeAtom,
  isGraphViableAtom,
  settingsAtom,
  TEXT_SIZE_OPTIONS,
  cycleChromeScale,
  pwaInstallPromptAtom,
  aboutModalOpenAtom,
  closeTabAtom,
  cycleActiveTabAtom,
  equationInputModalOpenAtom,
  equationEditSeedAtom,
  parseRawStringToEditSeed,
  openEquationEditorAtom,
  openEquationFromPasteAtom,
  activeWorkspacePristineAtom,
  shortcutsOverlayOpenAtom,
  helpModalOpenAtom,
  anyModalOpenAtom,
  activeZoomModeAtom,
  equationToFormat,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { APP_TAGLINE } from '../constants/brand';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, MessageSquarePlus, Trash2, GitBranch, LayoutGrid, Library, TrendingUp, ChevronUp, ChevronDown, ScanText, RefreshCw, Pencil, AlertTriangle } from 'lucide-react';
import { parseEquation, equationToString, decompressString } from 'math-engine-client';
import { useMathScale } from '../hooks/useMathScale';
import { useFLIPAnimation } from '../hooks/useFLIPAnimation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useEquationTreeFocus } from '../hooks/useEquationTreeFocus';
import { trackEvent } from '../utils/analytics';
import { fetchMathScan } from '../utils/mathScan';
import { safeStorage } from '../utils/safeStorage';
import { markAppHydrated } from '../utils/hydrationSentinel';


// Single shared safe storage wrapper (try/catch + in-memory fallback). Aliased
// to the historical `safeLocalStorage` name so every call site below is unchanged.
const safeLocalStorage = safeStorage;

// Layout effect on the client, plain effect on the server — avoids the SSR
// useLayoutEffect warning while still measuring before paint in the browser.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

// Gap (px) between the = sign and the portaled idle-hint popover. Matches the
// old `mb-3` (0.75rem) spacing now that positioning is computed, not class-based.
const EQUALS_POPOVER_GAP = 12;

interface MiniPetalInfo {
  readonly char: string;
  readonly x: number;
  readonly y: number;
  readonly tokenKey: keyof typeof THEME_GLASS;
}

const MINI_PETALS: readonly MiniPetalInfo[] = [
  { char: '↔', x: 0, y: -22, tokenKey: 'EQUALS_MINI_PETAL_SWAP' },
  { char: 'xⁿ', x: 17, y: -14, tokenKey: 'EQUALS_MINI_PETAL_POWER' },
  { char: '+', x: 22, y: 5, tokenKey: 'EQUALS_MINI_PETAL_ADD' },
  { char: '−', x: 10, y: 20, tokenKey: 'EQUALS_MINI_PETAL_SUB' },
  { char: '⋅', x: -10, y: 20, tokenKey: 'EQUALS_MINI_PETAL_MUL' },
  { char: '÷', x: -22, y: 5, tokenKey: 'EQUALS_MINI_PETAL_DIV' },
  { char: 'ⁿ√', x: -17, y: -14, tokenKey: 'EQUALS_MINI_PETAL_ROOT' },
];

/** True when `parseEquation` accepts the string — the arbiter for `decodeEqParam`. */
const isParseableEquation = (s: string): boolean => {
  try {
    parseEquation(s);
    return true;
  } catch {
    return false;
  }
};

/**
 * Read the raw `eq` query parameter and resolve it via `decodeEqParam` (see
 * eqParam.ts): Base64URL share tokens decode to the equation, while
 * hand-authored raw or percent-encoded links still resolve. We pull the value
 * straight from the query string rather than via `URLSearchParams.get`, which
 * applies form semantics and turns a literal `+` into a space — silently
 * corrupting a hand-written sum (e.g. `sqrt(2)+sqrt(2)` → `sqrt(2) sqrt(2)`).
 * Returns null when absent.
 */
const readEqParam = (search: string): string | null => {
  const match = search.match(/[?&]eq=([^&#]*)/);
  if (!match) return null;
  return decodeEqParam(match[1], isParseableEquation);
};

/**
 * Read the raw `ws` (workspace) query parameter. Since it is Base64URL encoded,
 * no further decoding is required. Returns null when absent.
 */
const readWsParam = (search: string): string | null => {
  const match = search.match(/[?&]ws=([^&#]*)/);
  if (!match) return null;
  return match[1];
};


export default function Home() {
  const currentEq = useAtomValue(currentEquationAtom);
  const liveAnnouncement = useAtomValue(liveAnnouncementAtom);
  const navReadout = useAtomValue(navReadoutAtom);
  const treeRefocusNonce = useAtomValue(treeRefocusNonceAtom);
  const candidatePaths = useAtomValue(candidatePathsAtom);
  const [, setHoverPath] = useAtom(hoverPathAtom);
  const [targetPaths, setTargetPaths] = useAtom(targetPathsAtom);
  const [sourcePath, setSourcePath] = useAtom(sourcePathAtom);
  // Exploration mode (#270): the clean, hierarchical structural-reading view that
  // replaces the interactive tree. A persistent live region narrates the mode switch
  // politely; the toggle ref takes focus back on exit so a keyboard/SR user is never
  // stranded outside the equation.
  const [explorationMode, setExplorationMode] = useAtom(explorationModeAtom);
  const [modeAnnouncement, setModeAnnouncement] = React.useState('');
  const exploreToggleRef = React.useRef<HTMLButtonElement>(null);
  // Speak the enclosing term when focus moves up/out to a containing item, where
  // VoiceOver otherwise goes silent on the label (#270/#271).
  const handleTreeFocusBridge = useAncestorFocusBridge();
  const toggleExploration = React.useCallback(() => {
    setExplorationMode((wasExploring) => {
      if (wasExploring) {
        setModeAnnouncement('Interactive view');
        return false;
      }
      setSourcePath(null); // a stale selection has no meaning while reading
      // The read view's own live region narrates the cursor; just announce the mode.
      setModeAnnouncement('Read view');
      return true;
    });
  }, [setExplorationMode, setSourcePath]);
  // On leaving the read view, return focus to its toggle so a keyboard/SR user isn't
  // stranded once the interactive tree remounts. In an effect (not the toggle
  // callback) so reading the ref stays out of render — react-hooks/refs.
  const prevExplorationRef = React.useRef(explorationMode);
  React.useEffect(() => {
    if (prevExplorationRef.current && !explorationMode) exploreToggleRef.current?.focus();
    prevExplorationRef.current = explorationMode;
  }, [explorationMode]);
  const [leftSidebarOpen, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const [rightSidebarOpen, setRightSidebarOpen] = useAtom(rightSidebarOpenAtom);
  
  const [tree, setTree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const [savedSessions, setSavedSessions] = useAtom(savedSessionsAtom);

  // Keyboard-focus management for the equation tree (#231): after a keyboard
  // apply or an edit-modal submit, move focus to the first actionable term so a
  // screen-reader/keyboard user isn't dropped to <body>. Keyed on the current
  // node id (a new equation) and re-attempted as the candidate set repopulates.
  const equationTreeFocusRef = React.useRef<HTMLDivElement>(null);
  const treeFocusHandlers = useEquationTreeFocus({
    containerRef: equationTreeFocusRef,
    equationKey: currentNodeId,
    candidatePathsKey: candidatePaths,
    refocusNonce: treeRefocusNonce,
    selectionKey: sourcePath,
  });
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const [currentSessionId, setCurrentSessionId] = useAtom(currentSessionIdAtom);

  const syncMathState = useSetAtom(syncMathStateAtom);
  const clearMathState = useSetAtom(clearMathStateAtom);
  const [feedbackOpen, setFeedbackModalOpen] = useAtom(feedbackModalOpenAtom);
  const setFeedbackContext = useSetAtom(feedbackContextAtom);
  const [settingsOpen, setSettingsModalOpen] = useAtom(settingsModalOpenAtom);
  const setExportWorkspacesModalOpen = useSetAtom(exportWorkspacesModalOpenAtom);
  const setImportWorkspacesModalOpen = useSetAtom(importWorkspacesModalOpenAtom);
  const [isMathLoading, setMathLoading] = useAtom(mathLoadingAtom);
  const hydrateWorkspaceTabs = useSetAtom(hydrateWorkspaceTabsAtom);
  const setAppHydrated = useSetAtom(appHydratedAtom);
  const createNewSession = useSetAtom(createNewSessionAtom);
  const createSessionFromState = useSetAtom(createSessionFromStateAtom);
  const setSharedWorkspaceBanner = useSetAtom(sharedWorkspaceBannerAtom);
  const setDeleteConfirmationModalOpen = useSetAtom(deleteConfirmationModalOpenAtom);
  const setResetHistoryModalOpen = useSetAtom(resetHistoryModalOpenAtom);
  const currentTabName = useAtomValue(currentTabNameAtom);
  const addTab = useSetAtom(addTabAtom);
  const [toast, setToast] = useAtom(toastAtom);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);

  const [activeBottomSheet, setActiveBottomSheet] = useAtom(activeBottomSheetAtom);
  const [radialMenuOpen, setRadialMenuOpen] = useAtom(radialMenuOpenAtom);
  const setRadialInitialAction = useSetAtom(radialInitialActionAtom);
  const onboardingChapterId = useAtomValue(onboardingChapterIdAtom);
  const onboardingGlobalOp = useAtomValue(onboardingGlobalOpAtom);
  // During the tour the equals sign is locked except on global-op steps
  const equalsLocked = !!onboardingChapterId && !onboardingGlobalOp;
  const swapSides = useSetAtom(swapSidesAtom);
  const setPwaInstallPrompt = useSetAtom(pwaInstallPromptAtom);
  const [aboutOpen, setAboutOpen] = useAtom(aboutModalOpenAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const cycleActiveTab = useSetAtom(cycleActiveTabAtom);
  const setEquationInputModalOpen = useSetAtom(equationInputModalOpenAtom);
  const setEquationEditSeed = useSetAtom(equationEditSeedAtom);
  const openEquationEditor = useSetAtom(openEquationEditorAtom);
  const openEquationFromPaste = useSetAtom(openEquationFromPasteAtom);
  const isWorkspacePristine = useAtomValue(activeWorkspacePristineAtom);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useAtom(shortcutsOverlayOpenAtom);
  const [helpOpen, setHelpOpen] = useAtom(helpModalOpenAtom);
  const anyModalOpen = useAtomValue(anyModalOpenAtom);

  // Keep the browser-tab title in sync with the active workspace name (#449).
  useDocumentTitle();

  const closeAllModals = () => {
    setAboutOpen(false);
    setHelpOpen(false);
    setFeedbackModalOpen(false);
    setSettingsModalOpen(false);
    setShortcutsOverlayOpen(false);
    setEquationInputModalOpen(false);
    setDeleteConfirmationModalOpen(false);
    setResetHistoryModalOpen(false);
    setExportWorkspacesModalOpen(false);
    setImportWorkspacesModalOpen(false);
  };

  const toggleAbout = () => {
    const nextState = !aboutOpen;
    closeAllModals();
    if (nextState) {
      setAboutOpen(true);
      trackEvent({ action: 'shortcut_open_about', category: 'keyboard' });
    }
  };

  const toggleHelp = () => {
    const nextState = !helpOpen;
    closeAllModals();
    if (nextState) {
      setHelpOpen(true);
      trackEvent({ action: 'shortcut_open_help', category: 'keyboard' });
    } else {
      trackEvent({ action: 'shortcut_close_help', category: 'keyboard' });
    }
  };

  const toggleFeedback = () => {
    const nextState = !feedbackOpen;
    closeAllModals();
    if (nextState) {
      setFeedbackContext(currentEq ? `Active Equation: ${equationToString(currentEq)}` : null);
      setFeedbackModalOpen(true);
      trackEvent({ action: 'shortcut_open_feedback', category: 'keyboard' });
    }
  };

  const toggleSettings = () => {
    const nextState = !settingsOpen;
    closeAllModals();
    if (nextState) {
      setSettingsModalOpen(true);
      trackEvent({ action: 'shortcut_open_settings', category: 'keyboard' });
    }
  };

  const toggleShortcuts = () => {
    const nextState = !shortcutsOverlayOpen;
    closeAllModals();
    if (nextState) {
      setShortcutsOverlayOpen(true);
      trackEvent({ action: 'shortcut_open_cheatsheet', category: 'keyboard' });
    }
  };
  const [graphSize, setGraphSize] = useAtom(graphSizeAtom);
  const previousGraphSize = useAtomValue(previousGraphSizeAtom);
  const [rightSidebarSize, setRightSidebarSize] = useAtom(rightSidebarSizeAtom);
  const previousRightSidebarSize = useAtomValue(previousRightSidebarSizeAtom);
  const [, setZoomMode] = useAtom(activeZoomModeAtom);
  const isGraphViable = useAtomValue(isGraphViableAtom);
  const isMobile = useIsMobile();
  // Short/landscape viewports collapse the horizontal tab strip into the compact
  // WorkspaceSwitcher anchored top-left of the canvas, reclaiming the tab band
  // (#247). Only one variant mounts, so the tab state is never duplicated.
  const isShortScreen = useIsShortScreen();
  const isVeryShortScreen = useIsVeryShortScreen();
  // Immersive hide-chrome (#252): lets the header + BottomNav retreat on tight
  // landscape so the expression gets nearly the full height. The header toggle
  // enters it at ≤500px tall; below ≤400px it auto-hides on its own. `active`
  // gates the PeekHandle (the way back). Resets on leaving the short-screen
  // breakpoint so the user is never stranded.
  const { active: immersiveActive, immersive, setImmersive } = useImmersiveChrome(
    isShortScreen,
    isVeryShortScreen,
  );

  const getRightSidebarLayout = () => {
    if (rightSidebarSize === 'wider') {
      return {
        panelClasses: 'w-[30rem] translate-x-0 opacity-100 lg:w-[30rem] lg:min-w-[30rem] lg:ml-4 lg:opacity-100',
        handlePosition: 'right-[31.5rem]',
      };
    }
    if (rightSidebarSize === 'normal') {
      return {
        panelClasses: 'w-80 translate-x-0 opacity-100 lg:w-80 lg:min-w-[20rem] lg:ml-4 lg:opacity-100',
        handlePosition: 'right-[21.5rem]',
      };
    }
    return {
      panelClasses: 'w-80 translate-x-full opacity-100 max-lg:pointer-events-none lg:w-0 lg:min-w-0 lg:ml-0 lg:opacity-0 lg:overflow-hidden lg:pointer-events-none',
      handlePosition: 'right-[0.5rem]',
    };
  };

  const rightSidebarLayout = getRightSidebarLayout();

  const equalsRef = React.useRef<HTMLSpanElement>(null);
  const equalsPopoverRef = React.useRef<HTMLDivElement>(null);
  const lastEqStrRef = React.useRef<string | null>(null);

  const [settings, setSettings] = useAtom(settingsAtom);
  const [showEqualsPopover, setShowEqualsPopover] = React.useState(false);
  // Fixed-viewport coords for the portaled idle-hint popover (#172). null until
  // measured, so we can hide it (opacity 0) for the first frame to avoid a flash
  // at (0,0). `placement` flips above→below when there isn't room overhead.
  const [equalsPopoverPos, setEqualsPopoverPos] = React.useState<
    { top: number; left: number } | null
  >(null);
  const showIdleHint = !equalsLocked && !radialMenuOpen && !settings.seenEqualsHint;
  const isEqualsPopoverOpen = showIdleHint && showEqualsPopover;

  // Permanently dismiss the equals-sign idle hint once the user interacts with it.
  const dismissEqualsHint = React.useCallback(() => {
    setShowEqualsPopover(false);
    setSettings((prev) => (prev.seenEqualsHint ? prev : { ...prev, seenEqualsHint: true }));
  }, [setSettings]);

  // Position the portaled idle-hint popover relative to the = sign. Because it
  // now lives on <body> (escaping the overflow-clipped/scaled equation canvas),
  // its coords are computed from the trigger rect and kept in sync on scroll /
  // resize. Clamp horizontally to the viewport; flip below the sign when there
  // isn't room above. Mirrors the Tooltip portal's positioning approach.
  useIsomorphicLayoutEffect(() => {
    if (!isEqualsPopoverOpen) {
      setEqualsPopoverPos(null);
      return;
    }
    const compute = () => {
      const anchor = equalsRef.current;
      const popover = equalsPopoverRef.current;
      if (!anchor) return;
      const a = anchor.getBoundingClientRect();
      const popW = popover?.offsetWidth ?? 192; // w-48 fallback before first measure
      const popH = popover?.offsetHeight ?? 160;
      // Horizontal: centre on the = sign, clamped 8px inside each viewport edge.
      const centerX = a.left + a.width / 2;
      const halfW = popW / 2;
      const left = Math.max(halfW + 8, Math.min(centerX, window.innerWidth - halfW - 8));
      // Vertical: prefer above the sign; fall back to below when it won't fit;
      // then clamp the box fully on-screen so it can never run off the top/bottom
      // (the extreme short-landscape case in #172's verify viewport).
      const fitsAbove = a.top - EQUALS_POPOVER_GAP - popH >= 8;
      const rawTop = fitsAbove ? a.top - EQUALS_POPOVER_GAP - popH : a.bottom + EQUALS_POPOVER_GAP;
      const top = Math.max(8, Math.min(rawTop, window.innerHeight - popH - 8));
      setEqualsPopoverPos({ left, top });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [isEqualsPopoverOpen]);

  // Close the equals info popover on Escape.
  React.useEffect(() => {
    if (!isEqualsPopoverOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEqualsPopover(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [isEqualsPopoverOpen]);

  const reduciblePaths = useAtomValue(reduciblePathsAtom);
  // Destructure so the ref-typed members (containerRef/contentRef) are kept
  // distinct from the state-typed ones (scale/isScaled); accessing them off a
  // single object trips react-hooks/refs, which treats any property of a
  // ref-bearing object as a potential ref read during render.
  const {
    containerRef: activeContainerRef,
    contentRef: activeContentRef,
    scale: activeScaleValue,
    isScaled: activeIsScaled,
  } = useMathScale(
    currentEq,
    [targetPaths, reduciblePaths, sourcePath, isHydrated],
    isMobile ? 8 : 24,
    0.4,
    2.8
  );

  const prefersReducedMotion = useReducedMotion();
  const setTreeAnimating = useSetAtom(isTreeAnimatingAtom);
  useFLIPAnimation(activeContainerRef, currentEq, prefersReducedMotion, setTreeAnimating);

  // Load initial state on mount (Client-side only to avoid Next.js SSR hydration mismatches)
  React.useEffect(() => {
    const initialize = async () => {
      try {
        // Hydrate workspace tabs state
        hydrateWorkspaceTabs();

        // A `/s#key` short link (#480) resolves + decrypts on the `/s` page, then
        // hands its compressed payload here out-of-band (sessionStorage, never the
        // URL). Consume it once — it is byte-identical to a `?ws=` value, so it
        // flows through the exact same loader below.
        const pendingShare = consumePendingShare();

        // If the URL carries an equation (?eq=) or workspace (?ws=) parameter — or a
        // short link handed one off — bypass the first-run onboarding tutorial so the
        // user sees the content immediately.
        const hasUrlParam = pendingShare || readWsParam(window.location.search) || readEqParam(window.location.search);
        if (hasUrlParam) {
          try {
            safeLocalStorage.setItem('algebranch_onboarding_completed', 'true');
          } catch (e) {
            console.warn('Failed to set onboarding completed flag:', e);
          }
        }

        // 0. Set default sidebar states for mobile/tablet
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
        if (isMobile) {
          setLeftSidebarOpen(false);
          setRightSidebarOpen(false);
        }

        // 1. First, load the library list of saved sessions
        let sessions: SavedSession[] = [];
        try {
          const savedSessionsRaw = safeLocalStorage.getItem('algebranch_saved_sessions');
          if (savedSessionsRaw) {
            const payload = unwrapVersioned<SavedSession[]>(savedSessionsRaw);
            if (payload) {
              sessions = payload;
              
              // Auto-migrate legacy default equation to the new optimized default
              let migrated = false;
              sessions = sessions.map(s => {
                if (s.id === 'session_initial' && s.name === '3 * x + 5 = x + 13') {
                  migrated = true;
                  const initialTree: Record<string, HistoryNode> = {
                    "0": {
                      id: "0",
                      equation: parseEquation(INITIAL_EQUATION_STRING),
                      parentId: null,
                      childrenIds: [],
                      label: "Initial",
                      timestamp: Date.now(),
                    }
                  };
                  return {
                    id: 'session_initial',
                    name: 'Sample Workspace',
                    timestamp: Date.now(),
                    tree: serializeTree(initialTree),
                    currentNodeId: "0",
                  };
                }
                return s;
              });

              if (migrated) {
                safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned(sessions)));
              }
            }

            setSavedSessions(sessions);
          }
        } catch (err) {
          console.error('Failed to load saved sessions list:', err);
        }

        // 1. Check URL query string parameters first to load shared workspaces or
        // equations. A short-link handoff (`pendingShare`) is a compressed workspace
        // payload too, so it takes the same path as `?ws=` — but an explicit `?ws=`
        // always wins, keeping classic stateless links unaffected (#480).
        const cleanStateStr = resolveInitialWsSource(readWsParam(window.location.search), pendingShare);
        if (cleanStateStr) {
          try {
            const decompressed = await decompressString(cleanStateStr);
            const envelope = JSON.parse(decompressed);
            let tree, currentNodeId, name;
            let isValid = false;

            if (envelope && SUPPORTED_WS_REPLAY_VERSIONS.has(envelope.v) && Array.isArray(envelope.r)) {
              // Replay format (#403): re-run the engine to reconstruct the tree.
              try {
                const deminified = deminifyReplayWorkspace(envelope);
                tree = deminified.tree;
                currentNodeId = deminified.currentNodeId;
                name = deminified.name;
                isValid = true;
                // A transform's output drifted since this link was made — it still
                // loaded, but a node may render slightly differently (#403).
                if (deminified.drift) {
                  setToast({ message: 'This shared link may render slightly differently on the current version.', key: Date.now() });
                }
              } catch (e) {
                console.error('Failed to replay workspace payload:', e);
              }
            } else if (envelope && SUPPORTED_SCHEMA_VERSIONS.has(envelope.v) && envelope.t) {
              try {
                const deminified = deminifyWorkspace(envelope);
                tree = deminified.tree;
                currentNodeId = deminified.currentNodeId;
                name = deminified.name;
                isValid = true;
              } catch (e) {
                console.error('Failed to deminify workspace payload:', e);
              }
            } else if (envelope && SUPPORTED_SCHEMA_VERSIONS.has(envelope.version) && envelope.payload) {
              tree = envelope.payload.tree;
              currentNodeId = envelope.payload.currentNodeId;
              name = envelope.payload.name;
              isValid = true;
            }

            if (isValid && tree && currentNodeId) {
              const { matched } = createSessionFromState({ tree, currentNodeId, name });
              // Recipient loop (#241): the link restored someone's full derivation —
              // acknowledge it and teach the share feature at this primed moment.
              // On a dedupe match (#299) nothing new arrived, so the store already
              // showed a "you already have this" toast — skip the banner. Once the
              // recipient has dismissed it (#263), every later share link stays quiet.
              if (!matched && !isSharedWorkspaceBannerDismissed()) setSharedWorkspaceBanner(true);
            } else {
              console.warn('Discarded legacy or invalid shared workspace version:', envelope?.version || envelope?.v);
              // An unrecognized `?ws=` version (e.g. a link made by a newer build)
              // used to open a blank app with no explanation (#451). Tell the
              // recipient why instead of silently discarding it.
              setToast({ message: 'This link needs a newer version of Algebranch to open.', key: Date.now() });
            }
            // Clear query parameter from the URL to prevent duplicate tabs on page refresh
            window.history.replaceState(null, '', window.location.pathname);
          } catch (err) {
            // A malformed `?ws=` (bad base64, truncated link) is expected user input,
            // not an app fault: warn (not error, which trips the Next dev overlay and
            // hides the toast) and surface it to the recipient instead of opening a
            // blank app with only a console message (#451).
            console.warn('Failed to parse shared state from URL:', err);
            setToast({ message: "This shared link couldn't be opened — it may be incomplete or corrupted.", key: Date.now() });
            window.history.replaceState(null, '', window.location.pathname);
          }
          return;
        }

        const cleanEqStr = readEqParam(window.location.search);
        if (cleanEqStr) {
          try {
            parseEquation(cleanEqStr);
            // Dedupe (#299): if an untouched workspace for this equation already
            // exists, open it (with a toast) rather than spawning a duplicate.
            createNewSession(cleanEqStr, undefined, { dedupe: true });
            // Clear query parameter from the URL to prevent duplicate tabs on page refresh
            window.history.replaceState(null, '', window.location.pathname);
            return;
          } catch (err) {
            console.warn('Failed to parse equation from URL query parameter:', err instanceof Error ? err.message : String(err));
            setToast({ message: 'Invalid shared equation format', key: Date.now() });
            const seed = parseRawStringToEditSeed(cleanEqStr);
            setEquationEditSeed(seed);
            setEquationInputModalOpen(true);
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
        
        // 3. Otherwise, check if there was a saved active session
        try {
          const savedSessionId = safeLocalStorage.getItem('algebranch_current_session_id');
          if (savedSessionId && sessions.length > 0) {
            const activeSession = sessions.find(s => s.id === savedSessionId);
            if (activeSession) {
              setTree(deserializeTree(activeSession.tree));
              setCurrentNodeId(activeSession.currentNodeId);
              setCurrentSessionId(savedSessionId);
              return;
            }
          }

          // Fallback: If no active session found but we have sessions in the list, load the first one
          if (sessions.length > 0) {
            const activeSession = sessions[0];
            setTree(deserializeTree(activeSession.tree));
            setCurrentNodeId(activeSession.currentNodeId);
            setCurrentSessionId(activeSession.id);
            safeLocalStorage.setItem('algebranch_current_session_id', activeSession.id);
            return;
          }

          // 4. Legacy migration fallback: Check old workspace storage keys (backward compatibility)
          const savedTreeRaw = safeLocalStorage.getItem('algebranch_history_tree');
          const savedNodeIdRaw = safeLocalStorage.getItem('algebranch_current_node_id');
          if (savedTreeRaw && savedNodeIdRaw) {
            const treePayload = unwrapVersioned<Record<string, SerializedHistoryNode>>(savedTreeRaw);
            const nodePayload = unwrapVersioned<string>(savedNodeIdRaw);
            if (treePayload && nodePayload) {
              const deserializedTree = deserializeTree(treePayload);
              setTree(deserializedTree);
              setCurrentNodeId(nodePayload);
              
              // Migrate legacy workspace into a new session
              const initialEqStr = equationToString(deserializedTree["0"].equation);
              const legacySessionId = `session_migrated_${Date.now()}`;
              const newSession: SavedSession = {
                id: legacySessionId,
                name: initialEqStr,
                timestamp: Date.now(),
                tree: treePayload,
                currentNodeId: nodePayload,
              };
              const updated = [newSession, ...sessions];
              setSavedSessions(updated);
              setCurrentSessionId(legacySessionId);
              safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned(updated)));
              safeLocalStorage.setItem('algebranch_current_session_id', legacySessionId);
              return;
            }
          }
        } catch (err) {
          console.error('Failed to load history from local storage:', err);
        }

        // 5. Default starting state if everything is empty
        const defaultId = "session_initial";
        setCurrentSessionId(defaultId);
        const initialTree: Record<string, HistoryNode> = {
          "0": {
            id: "0",
            equation: parseEquation(INITIAL_EQUATION_STRING),
            parentId: null,
            childrenIds: [],
            label: "Initial",
            timestamp: Date.now(),
          }
        };
        const defaultSession: SavedSession = {
          id: defaultId,
          name: "Sample Workspace",
          timestamp: Date.now(),
          tree: serializeTree(initialTree),
          currentNodeId: "0",
        };
        setSavedSessions([defaultSession]);
        safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned([defaultSession])));
        safeLocalStorage.setItem('algebranch_current_session_id', defaultId);
      } catch (err) {
        console.error('Initialization failed:', err);
        setInitError(err instanceof Error ? err.message : String(err));
      } finally {
        // Mark hydration complete once the mount-once localStorage load has run.
        setIsHydrated(true);
        // Signal global hydration so mount-time consumers (onboarding auto-resume)
        // can safely mutate persisted workspace state without clobbering it.
        setAppHydrated(true);
        // Stand the hydration watchdog down (and hide its overlay if a slow load
        // already tripped it) now that the app is actually up.
        markAppHydrated();
      }
    };

    initialize();
  }, [setTree, setCurrentNodeId, setSavedSessions, setCurrentSessionId, setLeftSidebarOpen, setRightSidebarOpen, hydrateWorkspaceTabs, createNewSession, createSessionFromState, setSharedWorkspaceBanner, setAppHydrated, setEquationInputModalOpen, setEquationEditSeed, setToast]);

  // Save derivation steps to local storage and update address bar URL reactively
  React.useEffect(() => {
    if (!tree || !currentNodeId || !tree[currentNodeId] || !currentSessionId) return;

    // Do not save to the "Recents" library list unless the user has actually modified the workspace,
    // or if the session is already registered in the library.
    const activeTab = tabs.find(t => t.id === activeTabId);
    const isAlreadySaved = savedSessions.some(s => s.id === currentSessionId);
    if (!isAlreadySaved && activeTab && !activeTab.isModified) {
      return;
    }

    // 1. Save active workspace to the current session's entry in savedSessions library
    try {
      const serialized = serializeTree(tree);
      const sessionName = currentTabName || "Sample Workspace";

      // Update the active session in our list
      setSavedSessions(prevSessions => {
        const index = prevSessions.findIndex(s => s.id === currentSessionId);
        
        let timestamp = Date.now();
        if (index > -1) {
          const existing = prevSessions[index];
          const isTreeDifferent = JSON.stringify(existing.tree) !== JSON.stringify(serialized);
          timestamp = isTreeDifferent ? Date.now() : existing.timestamp;
        }

        const updatedSession: SavedSession = {
          id: currentSessionId,
          name: sessionName,
          timestamp,
          tree: serialized,
          currentNodeId,
        };

        let nextSessions = [...prevSessions];
        if (index > -1) {
          nextSessions[index] = updatedSession;
        } else {
          // It's a new session, prepend it
          nextSessions = [updatedSession, ...nextSessions];
        }

        // Write the list to localStorage
        safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned(nextSessions)));
        return nextSessions;
      });

      // Also maintain the legacy/single active workspace key for other references
      safeLocalStorage.setItem('algebranch_history_tree', JSON.stringify(wrapVersioned(serialized)));
      safeLocalStorage.setItem('algebranch_current_node_id', JSON.stringify(wrapVersioned(currentNodeId)));
      safeLocalStorage.setItem('algebranch_current_session_id', currentSessionId);
    } catch (err) {
      console.error('Failed to save history to local storage:', err);
    }

    // Intentionally fires only on content changes (tree/node/session/name).
    // `tabs`/`activeTabId` are read only to gate whether to persist, and
    // `savedSessions` is *written* by this effect — including them would
    // re-fire on its own output and risk a save loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, currentNodeId, currentSessionId, setSavedSessions, currentTabName]);



  // Register PWA Service Worker on mount (production only)
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        const showUpdateToast = (waitingWorker: ServiceWorker) => {
          const reloadAction = () => {
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
          };

          // Set initial toast message immediately
          setToast({
            message: 'New version available',
            key: Date.now(),
            type: 'update',
            persistent: true,
            actionLabel: 'Reload',
            onAction: reloadAction
          });

          // Request version from the waiting service worker
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => {
            const swVersion = event.data?.version;
            if (swVersion) {
              setToast((prev) => {
                if (prev && prev.type === 'update') {
                  return {
                    ...prev,
                    message: `New version (${swVersion}) available`
                  };
                }
                return {
                  message: `New version (${swVersion}) available`,
                  key: Date.now(),
                  type: 'update',
                  persistent: true,
                  actionLabel: 'Reload',
                  onAction: reloadAction
                };
              });
            }
          };
          waitingWorker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        };

        const registerSW = () => {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
              // If there's already a waiting worker, prompt reload
              if (reg.waiting) {
                showUpdateToast(reg.waiting);
              }

              // Listen for future updates
              reg.addEventListener('updatefound', () => {
                const installingWorker = reg.installing;
                if (installingWorker) {
                  installingWorker.addEventListener('statechange', () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                      showUpdateToast(installingWorker);
                    }
                  });
                }
              });
            })
            .catch((err) => console.error('Service worker registration failed:', err));
        };

        const hadControllerOnLoad = !!navigator.serviceWorker.controller;
        let refreshing = false;
        const handleControllerChange = () => {
          if (!refreshing && hadControllerOnLoad) {
            refreshing = true;
            window.location.reload();
          }
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        if (document.readyState === 'complete') {
          registerSW();
        } else {
          window.addEventListener('load', registerSW);
          return () => {
            window.removeEventListener('load', registerSW);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          };
        }

        return () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
      } else {
        // In development, unregister service workers to avoid hot-reloading caching issues
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then(() => {
              console.log('Unregistered service worker in development mode.');
            });
          }
        });
      }
    }
  }, [setToast]);

  // Capture the browser's PWA install promotion event. We do NOT preventDefault
  // so the browser's native automatic promotion can still run when appropriate,
  // but we stash the event in an atom so a manual "Install App" button can
  // trigger it.
  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      setPwaInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [setPwaInstallPrompt]);

  // Cold-start path: the app was launched (or navigated) to ?about=true — e.g. a
  // first launch from the OS shortcut, or any browser that doesn't honor the
  // manifest's launch_handler (Safari). Open the modal and scrub the param.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('about') === 'true') {
      setAboutOpen(true);
      // Clean up the URL parameter to keep the address bar clean
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, [setAboutOpen]);

  // Warm-launch path: with manifest `launch_handler.client_mode = focus-existing`,
  // re-launching the OS "About" dock shortcut focuses this already-running window
  // (instead of spawning a new instance) and delivers the target URL here via the
  // Launch Handler API. We open the modal in place WITHOUT navigating, so the
  // user's current equation/workspace is preserved. Chromium-only; other browsers
  // fall back to the cold-start path above.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const launchQueue = (window as unknown as {
      launchQueue?: { setConsumer: (consumer: (params: { targetURL?: string }) => void) => void };
    }).launchQueue;
    if (!launchQueue) return;
    launchQueue.setConsumer((launchParams) => {
      if (!launchParams?.targetURL) return;
      try {
        if (new URL(launchParams.targetURL).searchParams.get('about') === 'true') {
          setAboutOpen(true);
        }
      } catch {
        // Malformed targetURL — ignore.
      }
    });
  }, [setAboutOpen]);

  React.useEffect(() => {
    if (!currentEq) return;

    const eqStr = equationToString(currentEq);
    const eqChanged = lastEqStrRef.current !== eqStr;
    lastEqStrRef.current = eqStr;

    // Clear old interactive paths/actions immediately during transition to prevent stale highlights/handles.
    // If only sourcePath changed, preserve reduciblePaths to prevent toolbar handles from flickering/shrinking!
    if (eqChanged) {
      clearMathState();
    } else {
      setTargetPaths({});
    }

    let active = true;
    const syncState = async () => {
      try {
        setMathLoading(true);
        const data = await fetchMathScan(currentEq, sourcePath, { isActive: () => active });

        if (!active) return;

        // Atomically synchronize state inside Jotai store action
        syncMathState(data);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Failed to sync math state from server:', err);
      } finally {
        if (active) {
          setMathLoading(false);
        }
      }
    };

    syncState();
    return () => {
      active = false;
    };
  }, [currentEq, sourcePath, syncMathState, clearMathState, setTargetPaths, setMathLoading]);

  // Hotkey path for equals operations (#322): open the radial menu straight into
  // an op's input panel, mirroring the bare-`=` guards (no equation / locked
  // tour). The menu reads radialInitialActionAtom on open and clears it.
  const openEqualsOp = (type: RadialInitialAction) => {
    if (!currentEq || equalsLocked) return;
    dismissEqualsHint();
    setRadialInitialAction(type);
    setRadialMenuOpen(true);
    trackEvent({ action: `shortcut_equals_${type}`, category: 'keyboard' });
  };

  // Scope → the noun the success toast names (#481). Matches the Share-menu rows:
  // C E / C D / C W copy an equation / derivation / workspace link respectively.
  const SHORT_LINK_CHORD_NOUN: Record<ShareScope, string> = {
    equation: 'Equation',
    path: 'Derivation',
    full: 'Workspace',
  };

  /* eslint-disable react-hooks/purity */
  // Copy a short link for `scope` from a keyboard chord (#481). Unlike the Share
  // menu rows, a chord copies a short link or *nothing*: when offline, or if the
  // mint fails, it toasts a signpost to the Share menu rather than silently copying
  // a giant self-contained URL the user could paste unaware. This keeps the chord's
  // clipboard promise honest — a short link, or a clear reason it couldn't make one.
  const copyShortLinkChord = async (scope: ShareScope, trackAction: string) => {
    const noun = SHORT_LINK_CHORD_NOUN[scope];
    try {
      const compressed = await serializeWorkspaceState(tree, currentNodeId, currentTabName, scope);
      if (!compressed) return; // nothing to share
      if (!navigator.onLine) {
        setToast({ message: "You're offline — open Share for a link that works offline.", key: Date.now(), type: 'error' });
        return;
      }
      const result = await createShareLink(compressed, window.location.origin);
      if (result.status !== 'ok') {
        setToast({ message: "Couldn't create a short link — open Share for a link that works offline.", key: Date.now(), type: 'error' });
        return;
      }
      const success = await safeCopyText(result.url);
      if (success) {
        setToast({ message: `${noun} link copied`, key: Date.now() });
        trackEvent({ action: trackAction, category: 'keyboard' });
      }
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  // Keyboard Shortcuts (Issue #17, expanded in #126; unified in #514). The
  // display + matching metadata for every binding lives once in SHORTCUT_CATALOG
  // (constants/shortcutCatalog.ts), shared with the `/shortcuts` reference page
  // and the `K` cheat-sheet. Here we attach the live action to each catalog entry
  // by id — the Record type forces exactly one action per catalog id, so a
  // documented binding can never lack a handler (and vice versa).
  const shortcutActions: Record<ShortcutId, () => void> = {
    'cycle-zoom': () => {
      setZoomMode((current) => {
        if (current === 'normal') return 'overview';
        if (current === 'overview') return 'full-tree';
        return 'normal';
      });
      trackEvent({ action: 'shortcut_cycle_zoom', category: 'keyboard' });
    },
    undo: () => {
      const activeNode = tree[currentNodeId];
      if (activeNode && activeNode.parentId) {
        setCurrentNodeId(activeNode.parentId);
        setSourcePath(null);
        setHoverPath(null);
        trackEvent({ action: 'shortcut_undo', category: 'keyboard' });
      }
    },
    redo: () => {
      const activeNode = tree[currentNodeId];
      if (activeNode && activeNode.childrenIds && activeNode.childrenIds.length > 0) {
        const nextId = activeNode.childrenIds[activeNode.childrenIds.length - 1];
        setCurrentNodeId(nextId);
        setSourcePath(null);
        setHoverPath(null);
        trackEvent({ action: 'shortcut_redo', category: 'keyboard' });
      }
    },
    'redo-ctrl-y': () => {
      const activeNode = tree[currentNodeId];
      if (activeNode && activeNode.childrenIds && activeNode.childrenIds.length > 0) {
        const nextId = activeNode.childrenIds[activeNode.childrenIds.length - 1];
        setCurrentNodeId(nextId);
        setSourcePath(null);
        setHoverPath(null);
        trackEvent({ action: 'shortcut_redo_y', category: 'keyboard' });
      }
    },
    'toggle-workspace': () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
      if (isMobile) {
        setActiveBottomSheet((prev) => (prev === 'workspace' ? null : 'workspace'));
      } else {
        setLeftSidebarOpen((prev) => !prev);
      }
      trackEvent({ action: 'shortcut_toggle_workspace', category: 'keyboard' });
    },
    'toggle-library': () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
      if (isMobile) {
        setActiveBottomSheet((prev) => (prev === 'library' ? null : 'library'));
      } else {
        setLeftSidebarOpen((prev) => !prev);
      }
      trackEvent({ action: 'shortcut_toggle_library', category: 'keyboard' });
    },
    'toggle-history': () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
      if (isMobile) {
        setActiveBottomSheet((prev) => (prev === 'history' ? null : 'history'));
      } else {
        if (rightSidebarSize === 'hidden') {
          setRightSidebarSize('normal');
        } else if (rightSidebarSize === 'wider') {
          setRightSidebarSize('normal');
        } else { // normal
          if (previousRightSidebarSize === 'wider') {
            setRightSidebarSize('hidden');
          } else {
            setRightSidebarSize('wider');
          }
        }
      }
      trackEvent({ action: 'shortcut_toggle_right_sidebar', category: 'keyboard' });
    },
    'clear-selection': () => {
      if (sourcePath !== null) {
        setSourcePath(null);
        trackEvent({ action: 'shortcut_deselect_node', category: 'keyboard' });
      }
    },
    'swap-sides': () => {
      swapSides();
      trackEvent({ action: 'shortcut_swap_sides', category: 'keyboard' });
    },
    'toggle-graph': () => {
      // Don't open a graph that isn't viable; only allow closing an open one.
      if (graphSize === 'hidden' && !isGraphViable) return;
      if (graphSize === 'hidden') {
        setGraphSize('split');
      } else if (graphSize === 'expand') {
        setGraphSize('split');
      } else { // split
        if (previousGraphSize === 'expand') {
          setGraphSize('hidden');
        } else {
          setGraphSize('expand');
        }
      }
      trackEvent({ action: 'shortcut_toggle_graph', category: 'keyboard' });
    },
    'toggle-read-view': () => {
      toggleExploration();
      trackEvent({ action: 'shortcut_toggle_exploration', category: 'keyboard' });
    },
    'text-size-larger': () => {
      const nextScale = cycleChromeScale(settings.chromeScale, 1);
      const label = TEXT_SIZE_OPTIONS.find((o) => o.scale === nextScale)?.label ?? '';
      setSettings((prev) => ({ ...prev, chromeScale: nextScale }));
      setToast({ message: `Interface text size: ${label}`, key: Date.now() });
      trackEvent({ action: 'shortcut_text_size_larger', category: 'keyboard', label });
    },
    'text-size-smaller': () => {
      const nextScale = cycleChromeScale(settings.chromeScale, -1);
      const label = TEXT_SIZE_OPTIONS.find((o) => o.scale === nextScale)?.label ?? '';
      setSettings((prev) => ({ ...prev, chromeScale: nextScale }));
      setToast({ message: `Interface text size: ${label}`, key: Date.now() });
      trackEvent({ action: 'shortcut_text_size_smaller', category: 'keyboard', label });
    },
    // ⌘C / ⌘V are handled by useClipboardBridge (native copy/paste events); these
    // displayOnly rows document them and are filtered out before the live handler.
    'copy-equation-text': () => {},
    'paste-new-equation': () => {},
    'share-equation-link': () => copyShortLinkChord('equation', 'shortcut_share_equation_link'),
    'share-derivation-link': () => copyShortLinkChord('path', 'shortcut_share_derivation_link'),
    'share-workspace-link': () => copyShortLinkChord('full', 'shortcut_share_workspace'),
    'new-workspace': () => {
      setEquationInputModalOpen(true);
      trackEvent({ action: 'shortcut_new_workspace', category: 'keyboard' });
    },
    'close-workspace': () => {
      closeTab(activeTabId);
      trackEvent({ action: 'shortcut_close_workspace', category: 'keyboard' });
    },
    'close-workspace-delete': () => {
      closeTab(activeTabId);
      trackEvent({ action: 'shortcut_close_workspace', category: 'keyboard' });
    },
    'next-workspace': () => {
      cycleActiveTab(1);
      trackEvent({ action: 'shortcut_next_workspace', category: 'keyboard' });
    },
    'prev-workspace': () => {
      cycleActiveTab(-1);
      trackEvent({ action: 'shortcut_prev_workspace', category: 'keyboard' });
    },
    help: toggleHelp,
    'shortcuts-overlay': toggleShortcuts,
    about: toggleAbout,
    feedback: toggleFeedback,
    'equals-menu': () => {
      if (!currentEq || equalsLocked) return;
      dismissEqualsHint();
      setRadialMenuOpen(!radialMenuOpen);
      trackEvent({ action: 'shortcut_toggle_equals_menu', category: 'keyboard' });
    },
    'add-both-sides': () => openEqualsOp('add'),
    'add-both-sides-bare': () => openEqualsOp('add'),
    'sub-both-sides': () => openEqualsOp('sub'),
    'mul-both-sides': () => openEqualsOp('mul'),
    'mul-both-sides-bare': () => openEqualsOp('mul'),
    'div-both-sides': () => openEqualsOp('div'),
    'power-both-sides': () => openEqualsOp('power'),
    'root-both-sides': () => openEqualsOp('root'),
    settings: toggleSettings,
    'settings-meta': toggleSettings,
  };

  const shortcutBindings: ShortcutConfig[] = SHORTCUT_CATALOG.map((entry) => ({
    ...entry,
    action: shortcutActions[entry.id],
  }));
  /* eslint-enable react-hooks/purity */

  const modalNavigationKeys = new Set(['?', 'k', 'a', 'f', ',']);
  // Display-only bindings (⌘C / ⌘V) document keys handled by useClipboardBridge, so
  // they must never reach the live handler — its no-op action would preventDefault
  // and swallow the native copy/paste. They stay in `shortcutBindings` for the
  // cheat-sheet, which renders the full array.
  const handlerBindings = shortcutBindings.filter((s) => !s.displayOnly);
  const workspaceBindings = handlerBindings.filter(
    (s) => !modalNavigationKeys.has(s.key.toLowerCase())
  );
  const modalNavigationBindings = handlerBindings.filter(
    (s) => modalNavigationKeys.has(s.key.toLowerCase())
  );

  useKeyboardShortcuts(workspaceBindings, {
    disabled: anyModalOpen,
    onPendingLeader: (leader) => {
      if (leader === 'c') {
        setToast({
          message: 'Copy a share link — E equation · D derivation · W workspace',
          key: Date.now(),
        });
      }
    },
  });

  useKeyboardShortcuts(modalNavigationBindings, {
    disabled: false,
  });

  // App-aware ⌘C / ⌘V (#440): idle ⌘C copies the current equation as Unicode
  // (WYSIWYG with the cards); ⌘V outside an input opens the New Equation modal
  // seeded from the clipboard. Native selection copy / in-field paste untouched.
  useClipboardBridge({
    disabled: anyModalOpen,
    getEquationUnicode: () => (currentEq ? equationToFormat(currentEq, 'unicode') : null),
    onIdleCopy: () => {
      setToast({ message: 'Equation copied', key: Date.now() });
      trackEvent({ action: 'clipboard_idle_copy', category: 'keyboard' });
    },
    onPaste: (text) => {
      openEquationFromPaste(text);
      trackEvent({ action: 'clipboard_paste_open', category: 'keyboard' });
    },
  });

  // Mobile swipe gestures logic
  React.useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    const swipeThreshold = 80;
    const edgeThreshold = 40;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Ignore vertical swipes (e.g. scrolling the page)
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      const screenWidth = window.innerWidth;
      const isLargeScreen = screenWidth >= 1024;
      if (isLargeScreen) return;

      // Swipe Right -> Open Left Drawer or Close Right Drawer
      if (deltaX > swipeThreshold) {
        if (rightSidebarOpen) {
          setRightSidebarOpen(false);
        } else if (!leftSidebarOpen && touchStartX < edgeThreshold) {
          setLeftSidebarOpen(true);
        }
      }
      // Swipe Left -> Open Right Drawer or Close Left Drawer
      else if (deltaX < -swipeThreshold) {
        if (leftSidebarOpen) {
          setLeftSidebarOpen(false);
        } else if (!rightSidebarOpen && (screenWidth - touchStartX) < edgeThreshold) {
          setRightSidebarOpen(true);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [leftSidebarOpen, rightSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen]);

  // Auto-dismiss toast status messages after 2.5 seconds
  React.useEffect(() => {
    if (!toast || toast.persistent) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [toast, setToast]);

  // Gracefully transition between desktop and mobile viewport states live on resize
  React.useEffect(() => {
    if (isHydrated) {
      if (isMobile) {
        setLeftSidebarOpen(false);
        setRightSidebarOpen(false);
        setActiveBottomSheet(null);
      } else {
        setLeftSidebarOpen(true);
        setRightSidebarOpen(true);
        setActiveBottomSheet(null);
      }
    }
  }, [isMobile, isHydrated, setLeftSidebarOpen, setRightSidebarOpen, setActiveBottomSheet]);


  return (
    <div className="relative flex flex-col h-dvh w-screen overflow-hidden overscroll-none bg-[#080711] text-white font-sans">
      {/* Keyboard fast-lane: must be the very first focusable element so it's the
          first Tab stop, ahead of the header and sidebars (#257). */}
      <SkipLinks />

      {/* Background neon grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Decorative ambient glow orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="app-header h-[var(--header-height)] px-4 flex items-center justify-between select-none shrink-0 w-full z-30">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-0 cursor-pointer hover:opacity-90 active:scale-98 transition-all">
            <Image
              src="/logo-textless.png"
              alt="Algebranch Logo"
              width={53}
              height={53}
              priority
              unoptimized
              className="header-logo h-[53px] w-[53px] object-contain rounded-full"
            />
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">Algebranch</h1>
              <p className="short-screen-hide text-xs text-indigo-300 font-semibold tracking-wider">
                {APP_TAGLINE}
              </p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ShareMenu
            equationString={currentEq ? equationToString(currentEq) : ''}
            getCompressedWorkspace={(scope) => serializeWorkspaceState(tree, currentNodeId, currentTabName, scope)}
            derivationStepCount={
              tree && currentNodeId && tree[currentNodeId]
                ? getActivePathIds(tree, currentNodeId).size - 1
                : 0
            }
            tooltip="Share this worked solution"
          />
          <Tooltip content="Submit Feedback or Report Bug" position="bottom" autoAlign={false}>
            <button
              onClick={toggleFeedback}
              className={THEME_GLASS.HEADER_BUTTON}
              aria-label="Feedback"
            >
              <MessageSquarePlus size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Feedback</span>
            </button>
          </Tooltip>
          {/* Enter immersive mode — only on short screens while chrome is shown
              (#252). The PeekHandle is the way back out. */}
          {isShortScreen && !immersive && (
            <ImmersiveToggle onEnter={() => setImmersive(true)} />
          )}
          <HeaderOverflowMenu
            onOpenSettings={toggleSettings}
            onOpenAbout={toggleAbout}
            onOpenHelp={toggleHelp}
            onOpenShortcuts={toggleShortcuts}
          />
        </div>
      </header>

      {/* Under-header Layout (Sidebar + Main Workspace + Right Sidebar). On
          desktop the pb-4 is the panel's bottom margin; below lg the fixed
          BottomNav covers the bottom and the workspace column already reserves
          the nav clearance (--bottom-nav-clearance), so this padding must NOT
          stack on top of it — otherwise it re-opens a too-large gap between the
          last element and the nav (#251). Hence lg:pb-4 only. */}
      <div className={`flex-1 flex w-full overflow-hidden min-h-0 relative z-20 px-4 max-lg:px-0 pt-0 ${
        onboardingChapterId ? 'pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-4' : 'pb-0 lg:pb-4'
      }`}>
        {/* Backdrop overlay for mobile drawers */}
        <div
          onClick={() => {
            setLeftSidebarOpen(false);
            setRightSidebarOpen(false);
          }}
          className={`fixed top-[var(--header-height)] left-0 right-0 bottom-0 bg-neutral-950/60 backdrop-blur-sm z-35 lg:hidden transition-all duration-300 ${
            (isHydrated && (leftSidebarOpen || rightSidebarOpen))
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* 1. Left Control Sidebar (Loader, Global Operations, Presets Library) */}
        <div className="hidden lg:block shrink-0">
          <Sidebar />
        </div>

        {/* Left Sidebar Edge Handle (Desktop Only) */}
        <div className="hidden lg:block">
          <Tooltip 
            content={<HotkeyHint label={leftSidebarOpen ? "Hide Left Sidebar" : "Show Left Sidebar"} keys={['W', 'L']} />}
            position="right"
            wrapperClassName={`absolute top-1/2 -translate-y-1/2 z-45 w-5 h-20 transition-all duration-300 ease-in-out ${
              leftSidebarOpen ? 'left-[21.5rem] -translate-x-1/2' : 'left-[0.5rem] -translate-x-1/2'
            }`}
          >
            <button
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className={THEME_GLASS.EDGE_HANDLE}
              aria-label={leftSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {leftSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </Tooltip>
        </div>

        {/* Main workspace section */}
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden gap-3">
          {/* Short/landscape viewports drop the in-flow tab band entirely; the
              WorkspaceSwitcher (rendered inside the canvas below) takes over so
              the scarce vertical axis goes to the math (#247). The strip still
              stays reachable mid-tutorial as a permanent escape hatch on roomy
              viewports — and the switcher preserves that escape hatch on short
              ones, since it is never gated behind onboarding state. */}
          {!isShortScreen && (
            isHydrated ? (
              <div className="shrink-0">
                <WorkspaceTabs />
              </div>
            ) : (
              <div className="shrink-0">
                <div className="w-full flex items-center justify-between bg-transparent px-0 max-lg:px-3 pt-2 pb-0 gap-4 shrink-0 select-none">
                  <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                    <div className="h-[30px] w-32 bg-white/5 border border-white/5 animate-pulse rounded-xl" />
                  </div>
                </div>
              </div>
            )
          )}
          {/* Workspace column. The fixed mobile BottomNav overlays the bottom of
              this column, so reserve its overlap (+ a small gap) HERE, once, via
              --bottom-nav-clearance — instead of the canvas / FactsStrip / graph
              each re-reserving it with diverging hardcoded values (#251). Skipped
              during the tour, when the nav is hidden and the coach card docks
              directly below. */}
          <div className={`flex-1 flex flex-col h-full min-h-0 relative ${THEME_GLASS.PANEL} overflow-hidden max-lg:border-x-0 max-lg:rounded-none ${
            onboardingChapterId ? '' : 'max-lg:pb-[calc(var(--bottom-nav-clearance)+var(--facts-gap))]'
          }`}>

            {/* 1. Active Derivation Workspace */}
            <div
              ref={activeContainerRef}
              id="equation-region"
              role="region"
              aria-label="Equation"
              // tabIndex=-1 lets the "Skip to equation" link land focus here
              // without adding a Tab stop (#257).
              tabIndex={-1}
              onClick={() => {
                if (sourcePath !== null) {
                  setSourcePath(null);
                }
              }}
              // Symmetric vertical padding so the auto-scaled expression sits
              // optically centered top/bottom (#251). The BottomNav clearance is
              // owned by the column wrapper now, so the canvas only carries its
              // own balanced gap. (The short-screen override in globals.css keeps
              // a larger top inset to clear the top-left switcher pill — the one
              // intentional asymmetry.)
              className={`active-workspace-canvas flex-1 flex flex-col items-center justify-center min-h-0 w-full px-2 py-4 sm:px-4 lg:px-8 lg:py-8 text-base font-light cursor-default relative group/canvas outline-none ${
                onboardingChapterId ? 'overflow-auto lg:overflow-hidden' : 'overflow-auto'
              }`}
            >
              {/* Collapsed workspace switcher — anchored top-left of the
                  expression space on short/landscape viewports, replacing the
                  reclaimed tab band (#247). Gated on hydration so it reads the
                  real, persisted tabs rather than the SSR fallback. */}
              {isShortScreen && isHydrated && (
                <div className="absolute top-3 left-3 z-40">
                  <WorkspaceSwitcher />
                </div>
              )}
              {/* Calculating Math Engine Spinner / Toast Notification */}
              {toast ? (
                <div key={`toast-${toast.key}`} className={`absolute top-4 left-4 z-30 short-screen-toast-offset ${toast.type === 'error' ? THEME_GLASS.TOAST_ERROR : THEME_GLASS.TOAST_ALERT} flex items-center gap-2`}>
                  {toast.type === 'update' ? (
                    <RefreshCw size={12} className="text-indigo-400 shrink-0 animate-[spin_3s_linear_infinite]" />
                  ) : toast.type === 'error' ? (
                    <AlertTriangle size={12} className="text-red-400 shrink-0" />
                  ) : (
                    <Check size={12} className="text-emerald-400 shrink-0" />
                  )}
                  <span>{toast.message}</span>
                  {toast.onAction && (
                    <button
                      onClick={toast.onAction}
                      className="ml-2 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition-all cursor-pointer active:scale-95 border border-indigo-400/20 shadow-md shadow-indigo-600/20"
                    >
                      {toast.actionLabel || 'Action'}
                    </button>
                  )}
                  {toast.type === 'update' && (
                    <button
                      onClick={() => setToast(null)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-zinc-300 font-semibold rounded-lg text-[10px] transition-all cursor-pointer active:scale-95 border border-white/5"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ) : isMathLoading ? (
                <div className={`absolute top-4 left-4 z-30 short-screen-toast-offset ${THEME_GLASS.TOAST_LOADING}`}>
                  <div className={`h-3 w-3 border-2 ${THEME_GLASS.SPINNER}`} />
                  <span>Calculating...</span>
                </div>
              ) : null}
              {/* Contextual Action Buttons for Active Workspace */}
              {currentEq && (
                <div className="absolute top-4 right-4 z-30 contextual-actions flex items-center gap-2">
                  {/* Read-view toggle (#270): switch between the Interactive view
                      (move handles, transform) and a clean Read view that strips the
                      chrome so the equation can be stepped through part by part. User-
                      facing name is "Read view"; the code concept is "exploration". A
                      real toggle button so a screen reader announces its pressed state,
                      with parallel tooltips that each name the view they switch to. */}
                  <Tooltip
                    content={
                      <HotkeyHint
                        label={explorationMode ? 'Interactive view' : 'Read view'}
                        keys="X"
                      />
                    }
                    position="left"
                  >
                    <button
                      ref={exploreToggleRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExploration();
                      }}
                      className={explorationMode ? THEME_GLASS.ICON_BUTTON_ACTIVE : THEME_GLASS.ICON_BUTTON}
                      aria-pressed={explorationMode}
                      aria-label="Read view"
                    >
                      <ScanText size={14} />
                    </button>
                  </Tooltip>

                  {/* Graph toggle — only offered when the equation is legitimately
                      graphable (single variable), or while the graph is already
                      open so it can always be closed. Replaces the old oversized
                      floating "Graph" pill. */}
                  {(isGraphViable || graphSize !== 'hidden') && (
                    <Tooltip content={<HotkeyHint label={graphSize === 'hidden' ? 'Show graph' : 'Hide graph'} keys="G" />} position="left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setGraphSize(graphSize === 'hidden' ? 'split' : 'hidden');
                        }}
                        className={graphSize === 'hidden' ? THEME_GLASS.ICON_BUTTON : THEME_GLASS.ICON_BUTTON_ACTIVE}
                        aria-label={graphSize === 'hidden' ? 'Show graph' : 'Hide graph'}
                      >
                        <TrendingUp size={14} />
                      </button>
                    </Tooltip>
                  )}

                  <Tooltip content={isWorkspacePristine ? 'Edit equation' : 'Edit as new workspace'} position="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEquationEditor();
                      }}
                      className={THEME_GLASS.ICON_BUTTON}
                      aria-label={isWorkspacePristine ? 'Edit equation' : 'Edit as new workspace'}
                    >
                      <Pencil size={14} />
                    </button>
                  </Tooltip>

                  <Tooltip content="Clone workspace" position="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addTab();
                      }}
                      className={THEME_GLASS.ICON_BUTTON}
                      aria-label="Clone workspace"
                    >
                      <GitBranch size={14} />
                    </button>
                  </Tooltip>

                  <Tooltip content="Delete workspace permanently" position="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmationModalOpen(true);
                      }}
                      disabled={isHydrated ? savedSessions.length <= 1 : undefined}
                      className={THEME_GLASS.ICON_BUTTON_DANGER}
                      aria-label="Delete workspace permanently"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                </div>
              )}
              {/* Persistent mode-switch narration (#270): lives OUTSIDE the swap
                  below so the announcement survives the tree being replaced. */}
              <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {modeAnnouncement}
              </div>
              {!isHydrated ? (
                <div data-initializing-spinner className="flex flex-col items-center justify-center gap-3 select-none">
                  <div className={`h-8 w-8 border-4 ${THEME_GLASS.SPINNER}`} />
                  <span className="text-sm font-medium text-indigo-300/80 animate-pulse tracking-wide">Initializing workspace...</span>
                  {initError && (
                    <div className={THEME_GLASS.BANNER_DANGER}>
                      Error: {initError}
                    </div>
                  )}
                </div>
              ) : explorationMode ? (
                // Exploration mode (#270): the clean, hierarchical structural tree
                // replaces the interactive one, self-scaling to fill the workspace.
                <ExploreEquationTree onExit={toggleExploration} />
              ) : (
                <RovingTabindexProvider containerRef={activeContentRef}>
                <div
                  className="flex flex-col items-center justify-center gap-2 origin-center"
                  ref={equationTreeFocusRef}
                  onFocusCapture={treeFocusHandlers.onFocusCapture}
                  onBlurCapture={treeFocusHandlers.onBlurCapture}
                >
                  {/* Screen-reader narration of the latest applied transform (#231).
                      Visually hidden; aria-atomic so the whole step is re-spoken. */}
                  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                    {liveAnnouncement}
                  </div>
                  {/* Assertive bridge (#270/#271): on step-OUT (up) moves VoiceOver
                      announces "group" and goes silent on the enclosing term's label,
                      so the roving handlers push that label here for it to be spoken. */}
                  <div aria-live="assertive" aria-atomic="true" className="sr-only">
                    {navReadout}
                  </div>
                  {/* The expression is a single composite widget (#257): one Tab
                      stop, arrow keys rove between actionable terms. tabIndex=-1
                      lets Escape release focus back here without adding a stop. */}
                  <div
                    ref={activeContentRef}
                    role="tree"
                    // The wrapping role="region" already announces "Equation";
                    // name the tree distinctly so it isn't said twice (#265).
                    aria-label="Interactive equation"
                    tabIndex={-1}
                    // Speak the enclosing term when focus moves up/out to a containing
                    // item, where VoiceOver otherwise goes silent (#270/#271).
                    onFocusCapture={handleTreeFocusBridge}
                    style={{
                      fontSize: `${activeScaleValue}em`,
                      opacity: activeIsScaled ? 1 : 0,
                    }}
                    className="flex items-center justify-center gap-[0.4em] sm:gap-[0.6em] lg:gap-[0.8em] flex-nowrap w-max outline-none"
                  >
                    {/* LHS Term Tree */}
                    <div className="flex justify-end min-w-[1.5em] sm:min-w-[3em] lg:min-w-[5em]">
                      <EquationNode path="lhs" key={(currentEq?.lhs as unknown as { id?: string })?.id || 'lhs'} />
                    </div>

                    {/* Equals Operator sign */}
                    <Tooltip content="Apply an operation to both sides" position="bottom" visible={equalsLocked || (showIdleHint && showEqualsPopover) ? false : undefined}>
                      <span
                        ref={equalsRef}
                        // The equals sign is an actionable equation node, so it is a
                        // treeitem in the role="tree" composite widget (#257). This
                        // is also required for validity: its idle-hint "?" badge is a
                        // <button>, and a button nested in a bare element under
                        // role="tree" violates aria-required-children — inside a
                        // treeitem it is allowed. tabIndex -1 keeps the single Tab
                        // stop (keyboard activation of global ops lands in a later PR).
                        role="treeitem"
                        aria-label="Apply an operation to both sides"
                        aria-selected={false}
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (equalsLocked) return;
                          dismissEqualsHint();
                          setRadialMenuOpen(!radialMenuOpen);
                        }}
                        className={`${THEME_GLASS.EQUALS_SIGN} ${
                          equalsLocked
                            ? 'cursor-default'
                            : THEME_GLASS.EQUALS_SIGN_INTERACTIVE
                        }`}
                      >
                        {RELATION_DISPLAY[currentEq?.relation ?? '='] ?? '='}
                        {showIdleHint && (
                          <button
                            type="button"
                            aria-label="What does the = sign do?"
                            // Out of the tab order: the equals treeitem is one node
                            // in the single-Tab-stop expression widget (#257).
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowEqualsPopover((prev) => !prev);
                            }}
                            className={THEME_GLASS.EQUALS_BADGE}
                          >
                            ?
                          </button>
                        )}
                        {isEqualsPopoverOpen && typeof document !== 'undefined' && createPortal(
                          <div
                            ref={equalsPopoverRef}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'fixed',
                              left: `${equalsPopoverPos?.left ?? 0}px`,
                              top: `${equalsPopoverPos?.top ?? 0}px`,
                              transform: 'translateX(-50%)',
                              opacity: equalsPopoverPos ? 1 : 0,
                              zIndex: 9999, // above all in-canvas content (#172)
                            }}
                            className={THEME_GLASS.EQUALS_POPOVER}
                          >
                            {/* Mini Radial Menu Preview */}
                            <span className="relative w-16 h-16 mx-auto mb-2.5 flex items-center justify-center pointer-events-none select-none">
                              {/* Center equals */}
                              <span className={THEME_GLASS.EQUALS_MINI_CENTER}>
                                =
                              </span>
                              {/* Outer mini petals */}
                              {MINI_PETALS.map((petal) => (
                                <span
                                  key={petal.char}
                                  style={{
                                    position: 'absolute',
                                    left: `calc(50% + ${petal.x}px)`,
                                    top: `calc(50% + ${petal.y}px)`,
                                    transform: 'translate(-50%, -50%)',
                                  }}
                                  className={`${THEME_GLASS.EQUALS_MINI_PETAL_BASE} ${THEME_GLASS[petal.tokenKey]}`}
                                >
                                  {petal.char}
                                </span>
                              ))}
                            </span>

                            <span className={THEME_GLASS.EQUALS_POPOVER_TITLE}>
                              Global Operations
                            </span>
                            <span className={THEME_GLASS.EQUALS_POPOVER_DESC}>
                              Click the <strong>=</strong> sign to apply an operation to both sides.
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissEqualsHint();
                              }}
                              className={THEME_GLASS.EQUALS_POPOVER_BTN}
                            >
                              Got it
                            </button>
                          </div>,
                          document.body
                        )}
                        {!!onboardingChapterId && onboardingGlobalOp && (
                          <span aria-hidden="true" className={`-inset-[0.4em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
                        )}
                      </span>
                    </Tooltip>

                    {/* RHS Term Tree */}
                    <div className="flex justify-start min-w-[1.5em] sm:min-w-[3em] lg:min-w-[5em]">
                      <EquationNode path="rhs" key={(currentEq?.rhs as unknown as { id?: string })?.id || 'rhs'} />
                    </div>
                  </div>
                  {/* Standing domain-restriction caveat (#486): the accumulated
                      ≠0 assumptions active on the current branch, shown under the
                      equation so the working answer never hides its conditions. */}
                  <ActiveRestrictionsCaveat />
                  {/* Standing terminal-state caveat (#487): whenever the tree is
                      frozen — ÷0 dead end, contradiction, or identity — this one
                      banner states why, the "no moves because…" cue under the
                      equation. At most one halt banner shows; it may stack under the
                      restriction caveat above when both apply. */}
                  <TerminalStateCaveat />
                </div>
                </RovingTabindexProvider>
              )}

            </div>

            {/* Substitutions available from other workspaces (#3) — docked at the
                bottom, clear of the tab bar and the nodes' handle rows */}
            <FactsStrip />

            {/* 2. Collapsible Bottom Graph Panel */}
            {graphSize !== 'hidden' && (
              <div 
                className={`border-t ${THEME_GLASS.PANEL_BORDER} relative flex flex-col bg-white/[0.01] transition-all duration-300 ease-in-out shrink-0`}
                style={{ height: graphSize === 'expand' ? '66%' : '33%' }}
              >
                {/* Graph resize/close controls sitting in the top-right corner of the header */}
                <div className="absolute right-4 top-1.5 z-35 select-none flex items-center bg-neutral-900 border border-white/10 rounded-full px-1.5 py-0.5 shadow-md">
                  <Tooltip content={<HotkeyHint label="Expand graph to 2/3" keys="G" />} position="top" autoAlign={false} className="max-w-max">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (graphSize === 'split') {
                          setGraphSize('expand');
                        }
                      }}
                      disabled={graphSize === 'expand'}
                      className="p-1 hover:bg-white/10 text-white/70 hover:text-white disabled:text-white/20 disabled:hover:bg-transparent rounded-full active:scale-90 transition-all cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Expand graph"
                    >
                      <ChevronUp size={14} />
                    </button>
                  </Tooltip>
                  <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                  <Tooltip content={<HotkeyHint label={graphSize === 'expand' ? "Shrink graph to 1/3" : "Hide graph"} keys="G" />} position="top" autoAlign={false} className="max-w-max">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (graphSize === 'expand') {
                          setGraphSize('split');
                        } else if (graphSize === 'split') {
                          setGraphSize('hidden');
                        }
                      }}
                      className="p-1 hover:bg-white/10 text-white/70 hover:text-white rounded-full active:scale-90 transition-all cursor-pointer"
                      aria-label={graphSize === 'expand' ? 'Shrink graph' : 'Hide graph'}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </Tooltip>
                </div>

                <div className="flex-1 min-h-0 w-full overflow-hidden">
                  <GraphPanel />
                </div>
              </div>
            )}

            <OnboardingTour />
            <DragNudgeHint />
            <SharedWorkspaceBanner />
            <StorageDegradedBanner />
          </div>
        </main>

        {/* Right Sidebar Edge Handle (Desktop Only) */}
        <div className="hidden lg:block">
          <Tooltip
            content={<HotkeyHint label={rightSidebarSize === 'hidden' ? "Show History Sidebar" : rightSidebarSize === 'wider' ? "Narrow History Sidebar" : "Widen History Sidebar"} keys="H" />}
            position="left"
            className="max-w-max"
            wrapperClassName={`absolute top-1/2 -translate-y-1/2 z-45 w-5 h-20 transition-all duration-300 ease-in-out ${
              rightSidebarLayout.handlePosition
            } translate-x-1/2`}
          >
            <div className="w-full h-full flex flex-col items-center justify-center rounded-full border border-white/10 bg-neutral-900/60 backdrop-blur-md text-white/50 shadow-lg shadow-black/40 py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (rightSidebarSize === 'hidden') {
                    setRightSidebarSize('normal');
                  } else if (rightSidebarSize === 'normal') {
                    setRightSidebarSize('wider');
                  }
                }}
                disabled={rightSidebarSize === 'wider'}
                className="p-1 text-white/50 hover:text-indigo-300 hover:scale-110 active:scale-90 transition-all cursor-pointer disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white/20 disabled:cursor-not-allowed"
                aria-label="Expand history panel"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="w-3 h-[1px] bg-white/10 my-0.5" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (rightSidebarSize === 'wider') {
                    setRightSidebarSize('normal');
                  } else if (rightSidebarSize === 'normal') {
                    setRightSidebarSize('hidden');
                  }
                }}
                className="p-1 text-white/50 hover:text-indigo-300 hover:scale-110 active:scale-90 transition-all cursor-pointer"
                aria-label={rightSidebarSize === 'wider' ? 'Shrink history panel' : 'Hide history panel'}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </Tooltip>
        </div>

        <div className="hidden lg:block shrink-0">
          <div className={`flex flex-col fixed top-[var(--header-height)] bottom-0 right-0 z-38 transform transition-all duration-300 ease-in-out lg:relative lg:top-0 lg:translate-x-0 lg:z-30 lg:flex lg:flex-col lg:h-full shrink-0 ${
            rightSidebarLayout.panelClasses
          }`}>
            <ControlPanel regionId="history-region" />
          </div>
        </div>
      </div>
      <FeedbackModal />
      <DeleteWorkspaceModal />
      <ResetHistoryModal />
      <EquationInputModal />
      <SettingsModal />
      <ExportWorkspacesModal />
      <ImportWorkspacesModal />
      <AboutModal />
      <ShortcutsOverlay shortcuts={shortcutBindings} />
      <HelpModal />

      {/* Mobile-only Bottom navigation and Sheets */}
      {!onboardingChapterId && <BottomNav />}

      {/* Immersive mode's only way back: thin peek tabs at the top/bottom edges
          (#252). Mounted solely while active, so it never joins the tab order
          when the chrome is shown. */}
      {immersiveActive && <PeekHandle onExit={() => setImmersive(false)} />}

      <BottomSheet
        isOpen={activeBottomSheet === 'workspace'}
        onClose={() => setActiveBottomSheet(null)}
        title={
          <>
            <LayoutGrid className="text-indigo-400" size={18} />
            <span>Workspace</span>
          </>
        }
        fitContent
      >
        <SidebarContent onCloseMobile={() => setActiveBottomSheet(null)} />
      </BottomSheet>

      <BottomSheet
        isOpen={activeBottomSheet === 'library'}
        onClose={() => setActiveBottomSheet(null)}
        title={
          <>
            <Library className="text-indigo-400" size={18} />
            <span>Equation Library</span>
          </>
        }
      >
        <EquationLibraryContent showHeader={false} onCloseMobile={() => setActiveBottomSheet(null)} />
      </BottomSheet>

      <BottomSheet
        isOpen={activeBottomSheet === 'history'}
        onClose={() => setActiveBottomSheet(null)}
      >
        <ControlPanel onCloseMobile={() => setActiveBottomSheet(null)} />
      </BottomSheet>

      <RadialMenu anchorRef={equalsRef} />
    </div>
  );
}
