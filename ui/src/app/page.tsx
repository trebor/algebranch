// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { EquationNode } from '../components/EquationNode';
import { Sidebar, SidebarContent, EquationLibraryContent } from '../components/Sidebar';
import { ControlPanel } from '../components/ControlPanel';
import { GraphPanel } from '../components/GraphPanel';
import { FeedbackModal } from '../components/FeedbackModal';
import { DeleteWorkspaceModal } from '../components/DeleteWorkspaceModal';
import { ResetHistoryModal } from '../components/ResetHistoryModal';
import { EquationInputModal } from '../components/EquationInputModal';
import { SettingsModal } from '../components/SettingsModal';
import { AboutModal } from '../components/AboutModal';
import { OnboardingTour } from '../components/OnboardingTour';
import { Tooltip } from '../components/Tooltip';
import { HotkeyHint } from '../components/HotkeyHint';
import { WorkspaceTabs } from '../components/WorkspaceTabs';
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher';
import { SkipLinks } from '../components/SkipLinks';
import { RovingTabindexProvider } from '../hooks/useRovingTabindex';
import { ShareMenu } from '../components/ShareMenu';
import { HeaderOverflowMenu } from '../components/HeaderOverflowMenu';
import { SharedWorkspaceBanner } from '../components/SharedWorkspaceBanner';
import { sharedWorkspaceBannerAtom } from '../store/sharedWorkspaceBanner';
import { FactsStrip } from '../components/FactsStrip';
import { BottomNav } from '../components/BottomNav';
import { BottomSheet } from '../components/BottomSheet';
import { RadialMenu } from '../components/RadialMenu';
import { useIsMobile } from '../hooks/useBreakpoint';
import { useIsShortScreen } from '../hooks/useIsShortScreen';
import { useKeyboardShortcuts, ShortcutConfig } from '../hooks/useKeyboardShortcuts';
import { ShortcutsOverlay } from '../components/ShortcutsOverlay';
import { buildEquationUrl, buildWorkspaceUrl } from '../utils/feedbackUrl';
import {
  currentEquationAtom,
  liveAnnouncementAtom,
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
  serializeTree,
  deserializeTree,
  serializeWorkspaceState,
  getActivePathIds,
  INITIAL_EQUATION_STRING,
  leftSidebarOpenAtom,
  rightSidebarOpenAtom,
  feedbackModalOpenAtom,
  feedbackContextAtom,
  settingsModalOpenAtom,
  mathLoadingAtom,
  hydrateWorkspaceTabsAtom,
  appHydratedAtom,
  toastAtom,
  createNewSessionAtom,
  createSessionFromStateAtom,
  currentTabNameAtom,
  deleteConfirmationModalOpenAtom,
  tabsAtom,
  activeTabIdAtom,
  activeBottomSheetAtom,
  radialMenuOpenAtom,
  swapSidesAtom,
  addTabAtom,
  onboardingChapterIdAtom,
  onboardingGlobalOpAtom,
  graphSizeAtom,
  previousGraphSizeAtom,
  isGraphViableAtom,
  settingsAtom,
  TEXT_SIZE_OPTIONS,
  cycleChromeScale,
  pwaInstallPromptAtom,
  aboutModalOpenAtom,
  closeTabAtom,
  cycleActiveTabAtom,
  equationInputModalOpenAtom,
  shortcutsOverlayOpenAtom,
  anyModalOpenAtom,
  equationToFormat,
  formatDerivation,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, MessageSquarePlus, Trash2, GitBranch, LayoutGrid, Library, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { parseEquation, equationToString, decompressString } from 'math-engine-client';
import { useMathScale } from '../hooks/useMathScale';
import { useFLIPAnimation } from '../hooks/useFLIPAnimation';
import { useEquationTreeFocus } from '../hooks/useEquationTreeFocus';
import { trackEvent } from '../utils/analytics';
import { fetchMathScan } from '../utils/mathScan';


// Safe wrapper around window.localStorage to prevent DOMException / SecurityError crashes on mobile browsers (incognito, LAN HTTP, etc.)
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('localStorage.getItem access denied:', e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('localStorage.setItem access denied:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('localStorage.removeItem access denied:', e);
    }
  }
};

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

/**
 * Read the raw `eq` query parameter and percent-decode it ONCE. We pull it
 * straight from the query string rather than via `URLSearchParams.get`, which
 * applies form semantics and turns a literal `+` into a space — silently
 * corrupting any equation with a sum (e.g. `sqrt(2)+sqrt(2)` → `sqrt(2) sqrt(2)`,
 * which then fails to parse). `decodeURIComponent` leaves `+` untouched, so both
 * the fully-encoded share links (`%2B`) and hand-written test URLs with a literal
 * `+` resolve correctly. Returns null when absent or undecodable.
 */
const readEqParam = (search: string): string | null => {
  const match = search.match(/[?&]eq=([^&#]*)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
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
  const treeRefocusNonce = useAtomValue(treeRefocusNonceAtom);
  const candidatePaths = useAtomValue(candidatePathsAtom);
  const [, setHoverPath] = useAtom(hoverPathAtom);
  const [targetPaths, setTargetPaths] = useAtom(targetPathsAtom);
  const [sourcePath, setSourcePath] = useAtom(sourcePathAtom);
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
  const setFeedbackModalOpen = useSetAtom(feedbackModalOpenAtom);
  const setFeedbackContext = useSetAtom(feedbackContextAtom);
  const setSettingsModalOpen = useSetAtom(settingsModalOpenAtom);
  const [isMathLoading, setMathLoading] = useAtom(mathLoadingAtom);
  const hydrateWorkspaceTabs = useSetAtom(hydrateWorkspaceTabsAtom);
  const setAppHydrated = useSetAtom(appHydratedAtom);
  const createNewSession = useSetAtom(createNewSessionAtom);
  const createSessionFromState = useSetAtom(createSessionFromStateAtom);
  const setSharedWorkspaceBanner = useSetAtom(sharedWorkspaceBannerAtom);
  const setDeleteConfirmationModalOpen = useSetAtom(deleteConfirmationModalOpenAtom);
  const currentTabName = useAtomValue(currentTabNameAtom);
  const addTab = useSetAtom(addTabAtom);
  const [toast, setToast] = useAtom(toastAtom);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);

  const [activeBottomSheet, setActiveBottomSheet] = useAtom(activeBottomSheetAtom);
  const [radialMenuOpen, setRadialMenuOpen] = useAtom(radialMenuOpenAtom);
  const onboardingChapterId = useAtomValue(onboardingChapterIdAtom);
  const onboardingGlobalOp = useAtomValue(onboardingGlobalOpAtom);
  // During the tour the equals sign is locked except on global-op steps
  const equalsLocked = !!onboardingChapterId && !onboardingGlobalOp;
  const swapSides = useSetAtom(swapSidesAtom);
  const setPwaInstallPrompt = useSetAtom(pwaInstallPromptAtom);
  const setAboutOpen = useSetAtom(aboutModalOpenAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const cycleActiveTab = useSetAtom(cycleActiveTabAtom);
  const setEquationInputModalOpen = useSetAtom(equationInputModalOpenAtom);
  const setShortcutsOverlayOpen = useSetAtom(shortcutsOverlayOpenAtom);
  const anyModalOpen = useAtomValue(anyModalOpenAtom);
  const [graphSize, setGraphSize] = useAtom(graphSizeAtom);
  const previousGraphSize = useAtomValue(previousGraphSizeAtom);
  const isGraphViable = useAtomValue(isGraphViableAtom);
  const isMobile = useIsMobile();
  // Short/landscape viewports collapse the horizontal tab strip into the compact
  // WorkspaceSwitcher anchored top-left of the canvas, reclaiming the tab band
  // (#247). Only one variant mounts, so the tab state is never duplicated.
  const isShortScreen = useIsShortScreen();
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

  useFLIPAnimation(activeContainerRef, currentEq);

  // Load initial state on mount (Client-side only to avoid Next.js SSR hydration mismatches)
  React.useEffect(() => {
    const initialize = async () => {
      try {
        // Hydrate workspace tabs state
        hydrateWorkspaceTabs();

        // If the URL contains an equation (?eq=) or workspace (?ws=) parameter,
        // bypass the first-run onboarding tutorial so the user sees the content immediately.
        const hasUrlParam = readWsParam(window.location.search) || readEqParam(window.location.search);
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
            sessions = JSON.parse(savedSessionsRaw);
            
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
              safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(sessions));
            }

            setSavedSessions(sessions);
          }
        } catch (err) {
          console.error('Failed to load saved sessions list:', err);
        }

        // 1. Check URL query string parameters first to load shared workspaces or equations
        const cleanStateStr = readWsParam(window.location.search);
        if (cleanStateStr) {
          try {
            const decompressed = await decompressString(cleanStateStr);
            const { tree, currentNodeId, name } = JSON.parse(decompressed);
            createSessionFromState({ tree, currentNodeId, name });
            // Recipient loop (#241): the link restored someone's full derivation —
            // acknowledge it and teach the share feature at this primed moment.
            setSharedWorkspaceBanner(true);
            // Clear query parameter from the URL to prevent duplicate tabs on page refresh
            window.history.replaceState(null, '', window.location.pathname);
          } catch (err) {
            console.error('Failed to parse shared state from URL:', err);
          }
          return;
        }

        const cleanEqStr = readEqParam(window.location.search);
        if (cleanEqStr) {
          try {
            createNewSession(cleanEqStr);
            // Clear query parameter from the URL to prevent duplicate tabs on page refresh
            window.history.replaceState(null, '', window.location.pathname);
          } catch (err) {
            console.error('Failed to parse equation from URL query parameter:', err);
          }
          return;
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
          const savedNodeId = safeLocalStorage.getItem('algebranch_current_node_id');
          if (savedTreeRaw && savedNodeId) {
            const parsedRaw = JSON.parse(savedTreeRaw);
            const deserializedTree = deserializeTree(parsedRaw);
            setTree(deserializedTree);
            setCurrentNodeId(savedNodeId);
            
            // Migrate legacy workspace into a new session
            const initialEqStr = equationToString(deserializedTree["0"].equation);
            const legacySessionId = `session_migrated_${Date.now()}`;
            const newSession: SavedSession = {
              id: legacySessionId,
              name: initialEqStr,
              timestamp: Date.now(),
              tree: parsedRaw,
              currentNodeId: savedNodeId,
            };
            const updated = [newSession, ...sessions];
            setSavedSessions(updated);
            setCurrentSessionId(legacySessionId);
            safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(updated));
            safeLocalStorage.setItem('algebranch_current_session_id', legacySessionId);
            return;
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
        safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify([defaultSession]));
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
      }
    };

    initialize();
  }, [setTree, setCurrentNodeId, setSavedSessions, setCurrentSessionId, setLeftSidebarOpen, setRightSidebarOpen, hydrateWorkspaceTabs, createNewSession, createSessionFromState, setSharedWorkspaceBanner, setAppHydrated]);

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
        safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(nextSessions));
        return nextSessions;
      });

      // Also maintain the legacy/single active workspace key for other references
      safeLocalStorage.setItem('algebranch_history_tree', JSON.stringify(serialized));
      safeLocalStorage.setItem('algebranch_current_node_id', currentNodeId);
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
        const registerSW = () => {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('Service worker registered successfully:', reg.scope))
            .catch((err) => console.error('Service worker registration failed:', err));
        };

        if (document.readyState === 'complete') {
          registerSW();
        } else {
          window.addEventListener('load', registerSW);
          return () => window.removeEventListener('load', registerSW);
        }
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
  }, []);

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

  // Keyboard Shortcuts (Issue #17, expanded in #126). Defined as a single
  // source-of-truth array so the live handler and the `?` cheat-sheet overlay
  // render from the same bindings and can't drift.
  const shortcutBindings: ShortcutConfig[] = [
    {
      key: 'z',
      meta: true,
      action: () => {
        const activeNode = tree[currentNodeId];
        if (activeNode && activeNode.parentId) {
          setCurrentNodeId(activeNode.parentId);
          setSourcePath(null);
          setHoverPath(null);
          trackEvent({
            action: 'shortcut_undo',
            category: 'keyboard',
          });
        }
      },
      description: 'Undo step',
      category: 'History',
    },
    {
      key: 'z',
      meta: true,
      shift: true,
      action: () => {
        const activeNode = tree[currentNodeId];
        if (activeNode && activeNode.childrenIds && activeNode.childrenIds.length > 0) {
          const nextId = activeNode.childrenIds[activeNode.childrenIds.length - 1];
          setCurrentNodeId(nextId);
          setSourcePath(null);
          setHoverPath(null);
          trackEvent({
            action: 'shortcut_redo',
            category: 'keyboard',
          });
        }
      },
      description: 'Redo step',
      category: 'History',
    },
    {
      key: 'y',
      meta: true,
      action: () => {
        const activeNode = tree[currentNodeId];
        if (activeNode && activeNode.childrenIds && activeNode.childrenIds.length > 0) {
          const nextId = activeNode.childrenIds[activeNode.childrenIds.length - 1];
          setCurrentNodeId(nextId);
          setSourcePath(null);
          setHoverPath(null);
          trackEvent({
            action: 'shortcut_redo_y',
            category: 'keyboard',
          });
        }
      },
      description: 'Redo step (Ctrl+Y)',
      category: 'History',
      hidden: true,
    },
    {
      key: 'w',
      action: () => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
        if (isMobile) {
          setActiveBottomSheet((prev) => (prev === 'workspace' ? null : 'workspace'));
        } else {
          setLeftSidebarOpen((prev) => !prev);
        }
        trackEvent({
          action: 'shortcut_toggle_workspace',
          category: 'keyboard',
        });
      },
      description: 'Toggle Workspace panel',
      category: 'Panels',
    },
    {
      key: 'l',
      action: () => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
        if (isMobile) {
          setActiveBottomSheet((prev) => (prev === 'library' ? null : 'library'));
        } else {
          setLeftSidebarOpen((prev) => !prev);
        }
        trackEvent({
          action: 'shortcut_toggle_library',
          category: 'keyboard',
        });
      },
      description: 'Toggle Equation Library',
      category: 'Panels',
    },
    {
      key: 'h',
      action: () => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
        if (isMobile) {
          setActiveBottomSheet((prev) => (prev === 'history' ? null : 'history'));
        } else {
          setRightSidebarOpen((prev) => !prev);
        }
        trackEvent({
          action: 'shortcut_toggle_right_sidebar',
          category: 'keyboard',
        });
      },
      description: 'Toggle History Sidebar',
      category: 'Panels',
    },
    {
      key: 'escape',
      action: () => {
        if (sourcePath !== null) {
          setSourcePath(null);
          trackEvent({
            action: 'shortcut_deselect_node',
            category: 'keyboard',
          });
        }
      },
      description: 'Clear selection',
      category: 'Equation',
    },
    {
      // Bare `s` swaps the two sides of the equation — reclaimed from the old
      // ⌘⇧S now that copy/share live under the `C` leader.
      key: 's',
      action: () => {
        swapSides();
        trackEvent({
          action: 'shortcut_swap_sides',
          category: 'keyboard',
        });
      },
      description: 'Swap equation sides',
      category: 'Equation',
    },
    {
      key: 'g',
      action: () => {
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
        trackEvent({
          action: 'shortcut_toggle_graph',
          category: 'keyboard',
        });
      },
      description: 'Toggle variable relationship graph size',
      category: 'Equation',
    },
    {
      // Bare `t` grows the interface text-size knob (#239) one step and wraps
      // from the largest back to the smallest; Shift+T goes the other way. The
      // wrap lets a user who overshoots keep tapping the same key to come back
      // around. A toast confirms the change, since the steps are subtle.
      key: 't',
      action: () => {
        const nextScale = cycleChromeScale(settings.chromeScale, 1);
        const label = TEXT_SIZE_OPTIONS.find((o) => o.scale === nextScale)?.label ?? '';
        setSettings((prev) => ({ ...prev, chromeScale: nextScale }));
        setToast({ message: `Interface text size: ${label}`, key: Date.now() });
        trackEvent({ action: 'shortcut_text_size_larger', category: 'keyboard', label });
      },
      description: 'Larger interface text',
      category: 'Accessibility',
    },
    {
      key: 't',
      shift: true,
      action: () => {
        const nextScale = cycleChromeScale(settings.chromeScale, -1);
        const label = TEXT_SIZE_OPTIONS.find((o) => o.scale === nextScale)?.label ?? '';
        setSettings((prev) => ({ ...prev, chromeScale: nextScale }));
        setToast({ message: `Interface text size: ${label}`, key: Date.now() });
        trackEvent({ action: 'shortcut_text_size_smaller', category: 'keyboard', label });
      },
      description: 'Smaller interface text',
      category: 'Accessibility',
    },
    {
      // Copy/share family under the `C` leader (#239). `C D` copies the whole
      // workspace transcript — the active derivation path, root → current.
      // Leader keys are bare, so native Cmd/Ctrl+C text-copy is untouched.
      leader: 'c',
      key: 'd',
      action: () => {
        navigator.clipboard
          .writeText(formatDerivation(tree, currentNodeId, 'plain'))
          .then(() => {
            setToast({ message: 'Derivation copied', key: Date.now() });
            trackEvent({ action: 'shortcut_copy_derivation', category: 'keyboard' });
          })
          .catch((err) => console.error('Failed to copy derivation:', err));
      },
      description: 'Copy full derivation as text',
      category: 'Copy & Share',
    },
    {
      // `C E` copies just the current equation as plain text.
      leader: 'c',
      key: 'e',
      action: () => {
        if (!currentEq) return;
        navigator.clipboard
          .writeText(equationToFormat(currentEq, 'plain'))
          .then(() => {
            setToast({ message: 'Equation copied', key: Date.now() });
            trackEvent({ action: 'shortcut_copy_equation', category: 'keyboard' });
          })
          .catch((err) => console.error('Failed to copy equation:', err));
      },
      description: 'Copy equation as text',
      category: 'Copy & Share',
    },
    {
      // `C W` copies a `?ws=` deep link that restores the entire workspace
      // (full history tree + name).
      leader: 'c',
      key: 'w',
      action: async () => {
        try {
          const compressed = await serializeWorkspaceState(tree, currentNodeId, currentTabName);
          const url = buildWorkspaceUrl(window.location.origin, compressed);
          if (!url) return;
          await navigator.clipboard.writeText(url);
          setToast({ message: 'Workspace link copied', key: Date.now() });
          trackEvent({ action: 'shortcut_share_workspace', category: 'keyboard' });
        } catch (err) {
          console.error('Failed to copy workspace link:', err);
        }
      },
      description: 'Copy workspace share link',
      category: 'Copy & Share',
    },
    {
      // `C L` copies the lighter `?eq=` link (reopens just the equation, not
      // the derivation tree).
      leader: 'c',
      key: 'l',
      action: () => {
        if (!currentEq) return;
        const url = buildEquationUrl(window.location.origin, equationToString(currentEq));
        if (!url) return;
        navigator.clipboard
          .writeText(url)
          .then(() => {
            setToast({ message: 'Equation link copied', key: Date.now() });
            trackEvent({ action: 'shortcut_share_equation', category: 'keyboard' });
          })
          .catch((err) => console.error('Failed to copy equation link:', err));
      },
      description: 'Copy equation share link',
      category: 'Copy & Share',
    },
    {
      key: 'n',
      action: () => {
        setEquationInputModalOpen(true);
        trackEvent({
          action: 'shortcut_new_workspace',
          category: 'keyboard',
        });
      },
      description: 'New workspace',
      category: 'Workspaces',
    },
    {
      // Cmd/Ctrl+Backspace (Delete is an alias below). We stay off the W key
      // (every Cmd/Ctrl+W variant is browser-reserved and fires above the page),
      // and require the modifier so an idle Backspace mash can't close workspaces
      // by accident. The editable-target guard also keeps it from ever stealing a
      // Backspace while typing. closeTabAtom resets the last tab rather than
      // deleting it, so this is safe with a single workspace open.
      key: 'backspace',
      meta: true,
      action: () => {
        closeTab(activeTabId);
        trackEvent({
          action: 'shortcut_close_workspace',
          category: 'keyboard',
        });
      },
      description: 'Close workspace',
      category: 'Workspaces',
    },
    {
      // Delete alias for the close-workspace binding; hidden from the cheat-sheet
      // so the list shows a single canonical row.
      key: 'delete',
      meta: true,
      action: () => {
        closeTab(activeTabId);
        trackEvent({
          action: 'shortcut_close_workspace',
          category: 'keyboard',
        });
      },
      description: 'Close workspace',
      category: 'Workspaces',
      hidden: true,
    },
    {
      // Bare `]` / `[` (editor convention) — avoids the browser/OS tab-switch
      // hijacks that plague Cmd/Ctrl+Alt+Arrow and Ctrl+Tab cross-platform.
      key: ']',
      action: () => {
        cycleActiveTab(1);
        trackEvent({
          action: 'shortcut_next_workspace',
          category: 'keyboard',
        });
      },
      description: 'Next workspace',
      category: 'Workspaces',
    },
    {
      key: '[',
      action: () => {
        cycleActiveTab(-1);
        trackEvent({
          action: 'shortcut_prev_workspace',
          category: 'keyboard',
        });
      },
      description: 'Previous workspace',
      category: 'Workspaces',
    },
    {
      // `?` is produced with Shift on the keyboards we target, so match Shift
      // here; the overlay shows the plain `?` glyph via keyLabel.
      key: '?',
      shift: true,
      action: () => {
        setShortcutsOverlayOpen(true);
        trackEvent({
          action: 'shortcut_open_cheatsheet',
          category: 'keyboard',
        });
      },
      description: 'Show keyboard shortcuts',
      category: 'Help',
      keyLabel: '?',
    },
    {
      key: 'a',
      action: () => {
        setAboutOpen(true);
        trackEvent({ action: 'shortcut_open_about', category: 'keyboard' });
      },
      description: 'About Algebranch',
      category: 'Help',
    },
    {
      key: 'f',
      action: () => {
        // Mirror the header Feedback button: seed the form with the active
        // equation as context when there is one.
        setFeedbackContext(currentEq ? `Active Equation: ${equationToString(currentEq)}` : null);
        setFeedbackModalOpen(true);
        trackEvent({ action: 'shortcut_open_feedback', category: 'keyboard' });
      },
      description: 'Send feedback',
      category: 'Help',
    },
    {
      // Open the global equals menu (apply an operation to both sides) — the same
      // action as clicking the = sign. Skip when there's no equation or the sign
      // is locked.
      key: '=',
      action: () => {
        if (!currentEq || equalsLocked) return;
        dismissEqualsHint();
        setRadialMenuOpen(!radialMenuOpen);
        trackEvent({ action: 'shortcut_toggle_equals_menu', category: 'keyboard' });
      },
      description: 'Apply an operation to both sides',
      category: 'Equation',
      keyLabel: '=',
    },
    {
      // Settings on bare `,`, echoing the universal ⌘, convention in the app's
      // naked-key scheme.
      key: ',',
      action: () => {
        setSettingsModalOpen(true);
        trackEvent({ action: 'shortcut_open_settings', category: 'keyboard' });
      },
      description: 'Settings',
      category: 'Help',
      keyLabel: ',',
    },
    {
      // ⌘, alias for muscle memory; hidden so the cheat-sheet shows the bare key.
      key: ',',
      meta: true,
      action: () => {
        setSettingsModalOpen(true);
        trackEvent({ action: 'shortcut_open_settings', category: 'keyboard' });
      },
      description: 'Settings',
      category: 'Help',
      hidden: true,
    },
  ];
  useKeyboardShortcuts(shortcutBindings, {
    disabled: anyModalOpen,
    // Surface what follows an armed leader, so the sequence is discoverable in
    // the moment (not only via the ? cheat-sheet).
    onPendingLeader: (leader) => {
      if (leader === 'c') {
        setToast({
          message: 'Copy / share — D derivation · E equation · L link · W workspace',
          key: Date.now(),
        });
      }
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
    if (!toast) return;
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
      <header className="h-[var(--header-height)] px-4 flex items-center justify-between select-none shrink-0 w-full z-30">
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
                Interactive Algebra
              </p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ShareMenu
            equationString={currentEq ? equationToString(currentEq) : ''}
            getCompressedWorkspace={() => serializeWorkspaceState(tree, currentNodeId, currentTabName)}
            derivationStepCount={
              tree && currentNodeId && tree[currentNodeId]
                ? getActivePathIds(tree, currentNodeId).size - 1
                : 0
            }
            tooltip="Share this worked solution"
          />
          <Tooltip content="Submit Feedback or Report Bug" position="bottom" autoAlign={false}>
            <button
              onClick={() => {
                if (currentEq) {
                  setFeedbackContext(`Active Equation: ${equationToString(currentEq)}`);
                } else {
                  setFeedbackContext(null);
                }
                setFeedbackModalOpen(true);
              }}
              className={THEME_GLASS.HEADER_BUTTON}
              aria-label="Feedback"
            >
              <MessageSquarePlus size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Feedback</span>
            </button>
          </Tooltip>
          <HeaderOverflowMenu
            onOpenSettings={() => setSettingsModalOpen(true)}
            onOpenAbout={() => setAboutOpen(true)}
          />
        </div>
      </header>

      {/* Under-header Layout (Sidebar + Main Workspace + Right Sidebar) */}
      <div className={`flex-1 flex w-full overflow-hidden min-h-0 relative z-20 px-4 max-lg:px-0 pt-0 ${
        onboardingChapterId ? 'pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-4' : 'pb-4'
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
          <div className={`flex-1 flex flex-col h-full min-h-0 relative ${THEME_GLASS.PANEL} overflow-hidden max-lg:border-x-0 max-lg:rounded-none`}>

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
              className={`active-workspace-canvas flex-1 flex flex-col items-center justify-center min-h-0 w-full px-2 pt-16 sm:px-4 sm:pt-4 lg:px-8 lg:pt-8 text-base font-light cursor-default relative group/canvas outline-none ${
                onboardingChapterId
                  ? 'pb-4 lg:pb-8 overflow-auto lg:overflow-hidden'
                  // The fixed BottomNav (h-14 + safe-area, lg:hidden) overlays the
                  // canvas bottom on phones/tablets; pad the centering region down
                  // to the nav's top edge so the expression centers in the visible
                  // space above it rather than sinking behind it (#247 follow-up).
                  // The canvas background still extends behind the nav as intended.
                  : 'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.75rem)] lg:pb-8 overflow-auto'
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
                <div key={`toast-${toast.key}`} className={`absolute top-4 left-4 z-30 short-screen-toast-offset ${THEME_GLASS.TOAST_ALERT}`}>
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span>{toast.message}</span>
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
                      disabled={savedSessions.length <= 1}
                      className={THEME_GLASS.ICON_BUTTON_DANGER}
                      aria-label="Delete workspace permanently"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                </div>
              )}
              {!isHydrated ? (
                <div className="flex flex-col items-center justify-center gap-3 select-none">
                  <div className={`h-8 w-8 border-4 ${THEME_GLASS.SPINNER}`} />
                  <span className="text-sm font-medium text-indigo-300/80 animate-pulse tracking-wide">Initializing workspace...</span>
                  {initError && (
                    <div className={THEME_GLASS.BANNER_DANGER}>
                      Error: {initError}
                    </div>
                  )}
                </div>
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
                className={`border-t ${THEME_GLASS.PANEL_BORDER} relative flex flex-col bg-white/[0.01] transition-all duration-300 ease-in-out shrink-0 max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom))]`}
                style={{ height: graphSize === 'expand' ? '66%' : '33%' }}
              >
                {/* Graph resize/close controls sitting in the top-right corner of the header */}
                <div className="absolute right-4 top-1.5 z-35 select-none flex items-center bg-neutral-900 border border-white/10 rounded-full px-1.5 py-0.5 shadow-md">
                  <Tooltip content={<HotkeyHint label="Expand graph (2/3)" keys="G" />} position="top" autoAlign={false}>
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
                  <Tooltip content={<HotkeyHint label={graphSize === 'expand' ? "Shrink graph (1/3)" : "Hide graph"} keys="G" />} position="top" autoAlign={false}>
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
            <SharedWorkspaceBanner />
          </div>
        </main>

        {/* Right Sidebar Edge Handle (Desktop Only) */}
        <div className="hidden lg:block">
          <Tooltip 
            content={<HotkeyHint label={rightSidebarOpen ? "Hide History Sidebar" : "Show History Sidebar"} keys="H" />}
            position="left"
            wrapperClassName={`absolute top-1/2 -translate-y-1/2 z-45 w-5 h-20 transition-all duration-300 ease-in-out ${
              rightSidebarOpen ? 'right-[21.5rem] translate-x-1/2' : 'right-[0.5rem] translate-x-1/2'
            }`}
          >
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className={THEME_GLASS.EDGE_HANDLE}
              aria-label={rightSidebarOpen ? "Close history" : "Open history"}
            >
              {rightSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </Tooltip>
        </div>

        <div className="hidden lg:block shrink-0">
          <div className={`flex flex-col fixed top-[var(--header-height)] bottom-0 right-0 z-38 transform transition-all duration-300 ease-in-out ${
            rightSidebarOpen 
              ? 'w-80 translate-x-0 opacity-100' 
              : 'w-80 translate-x-full opacity-100 max-lg:pointer-events-none'
          } lg:relative lg:top-0 lg:translate-x-0 lg:z-30 lg:flex lg:flex-col lg:h-full ${
            rightSidebarOpen 
              ? 'lg:w-80 lg:min-w-[20rem] lg:ml-4 lg:opacity-100' 
              : 'lg:w-0 lg:min-w-0 lg:ml-0 lg:opacity-0 lg:overflow-hidden lg:pointer-events-none'
          } shrink-0`}>
            <ControlPanel regionId="history-region" />
          </div>
        </div>
      </div>
      <FeedbackModal />
      <DeleteWorkspaceModal />
      <ResetHistoryModal />
      <EquationInputModal />
      <SettingsModal />
      <AboutModal />
      <ShortcutsOverlay shortcuts={shortcutBindings} />

      {/* Mobile-only Bottom navigation and Sheets */}
      {!onboardingChapterId && <BottomNav />}

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
