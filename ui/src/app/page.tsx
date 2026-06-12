'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { EquationNode } from '../components/EquationNode';
import { Sidebar, SidebarContent, EquationLibraryContent } from '../components/Sidebar';
import { ControlPanel, TimelineContent } from '../components/ControlPanel';
import { GraphPanel } from '../components/GraphPanel';
import { FeedbackModal } from '../components/FeedbackModal';
import { DeleteWorkspaceModal } from '../components/DeleteWorkspaceModal';
import { ResetHistoryModal } from '../components/ResetHistoryModal';
import { EquationInputModal } from '../components/EquationInputModal';
import { OnboardingTour } from '../components/OnboardingTour';
import { Tooltip } from '../components/Tooltip';
import { WorkspaceTabs } from '../components/WorkspaceTabs';
import { FactsStrip } from '../components/FactsStrip';
import { BottomNav } from '../components/BottomNav';
import { BottomSheet } from '../components/BottomSheet';
import { RadialMenu } from '../components/RadialMenu';
import { useIsMobile } from '../hooks/useBreakpoint';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import {
  currentEquationAtom,
  hoverPathAtom,
  targetPathsAtom,
  reduciblePathsAtom,
  hoverReducePathAtom,
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
  INITIAL_EQUATION_STRING,
  leftSidebarOpenAtom,
  rightSidebarOpenAtom,
  feedbackModalOpenAtom,
  feedbackContextAtom,
  mathLoadingAtom,
  hydrateWorkspaceTabsAtom,
  appHydratedAtom,
  toastAtom,
  createNewSessionAtom,
  currentTabNameAtom,
  deleteSessionAtom,
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
  availableFactsAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_ANIMATIONS } from '../constants/theme';
import Image from 'next/image';
import { Share2, Check, Menu, BookOpen, ChevronLeft, ChevronRight, MessageSquarePlus, Trash2, GitBranch, LayoutGrid, Library, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { Equation, parseEquation, ensureNodeIds, equationToString } from 'math-engine-client';
import { useMathScale } from '../hooks/useMathScale';
import { useFLIPAnimation } from '../hooks/useFLIPAnimation';
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

export default function Home() {
  const currentEq = useAtomValue(currentEquationAtom);
  const [hoverPath, setHoverPath] = useAtom(hoverPathAtom);
  const [targetPaths, setTargetPaths] = useAtom(targetPathsAtom);
  const hoverReducePath = useAtomValue(hoverReducePathAtom);
  const [sourcePath, setSourcePath] = useAtom(sourcePathAtom);
  const [leftSidebarOpen, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const [rightSidebarOpen, setRightSidebarOpen] = useAtom(rightSidebarOpenAtom);
  
  const [tree, setTree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const [sharedCopied, setSharedCopied] = React.useState(false);
  const [savedSessions, setSavedSessions] = useAtom(savedSessionsAtom);
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const [currentSessionId, setCurrentSessionId] = useAtom(currentSessionIdAtom);

  const syncMathState = useSetAtom(syncMathStateAtom);
  const clearMathState = useSetAtom(clearMathStateAtom);
  const setFeedbackModalOpen = useSetAtom(feedbackModalOpenAtom);
  const setFeedbackContext = useSetAtom(feedbackContextAtom);
  const [isMathLoading, setMathLoading] = useAtom(mathLoadingAtom);
  const hydrateWorkspaceTabs = useSetAtom(hydrateWorkspaceTabsAtom);
  const setAppHydrated = useSetAtom(appHydratedAtom);
  const createNewSession = useSetAtom(createNewSessionAtom);
  const deleteSession = useSetAtom(deleteSessionAtom);
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
  const [graphSize, setGraphSize] = useAtom(graphSizeAtom);
  const previousGraphSize = useAtomValue(previousGraphSizeAtom);
  const availableFacts = useAtomValue(availableFactsAtom);
  const isMobile = useIsMobile();
  const equalsRef = React.useRef<HTMLSpanElement>(null);
  const lastEqStrRef = React.useRef<string | null>(null);

  const reduciblePaths = useAtomValue(reduciblePathsAtom);
  const activeScale = useMathScale(
    currentEq,
    [targetPaths, reduciblePaths, sourcePath, isHydrated, isMathLoading],
    isMobile ? 8 : 24,
    0.4,
    isMathLoading ? 1.6 : 2.8
  );

  useFLIPAnimation(activeScale.containerRef, currentEq);

  // Load initial state on mount (Client-side only to avoid Next.js SSR hydration mismatches)
  React.useEffect(() => {
    const initialize = () => {
      try {
        // Hydrate workspace tabs state
        hydrateWorkspaceTabs();

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

        // Check if we have saved tabs to prevent overwriting hydrated tab trees with stale sessions
        const hasSavedTabs = typeof window !== 'undefined' && safeLocalStorage.getItem('algebranch_workspace_tabs') !== null;
        if (hasSavedTabs) {
          const params = new URLSearchParams(window.location.search);
          const urlEq = params.get('eq');
          if (urlEq) {
            try {
              const cleanEqStr = decodeURIComponent(urlEq);
              createNewSession(cleanEqStr);
              // Clear query parameter from the URL to prevent duplicate tabs on page refresh
              window.history.replaceState(null, '', window.location.pathname);
            } catch (err) {
              console.error('Failed to parse equation from URL query parameter:', err);
            }
          }
          return;
        }

        // 2. Check URL query string precedence (if sharing) - for legacy/first load without workspace tabs
        const params = new URLSearchParams(window.location.search);
        const urlEq = params.get('eq');
        
        if (urlEq) {
          try {
            const cleanEqStr = decodeURIComponent(urlEq);
            const newEq = ensureNodeIds(parseEquation(cleanEqStr));
            const newTree: Record<string, HistoryNode> = {
              "0": {
                id: "0",
                equation: newEq,
                parentId: null,
                childrenIds: [],
                label: "Initial",
                timestamp: Date.now(),
              }
            };

            // Create a new session for the shared link so it doesn't overwrite existing work
            const newSessionId = `session_shared_${Date.now()}`;
            setTree(newTree);
            setCurrentNodeId("0");
            setCurrentSessionId(newSessionId);

            // Add this new shared session to the library list
            const newSession: SavedSession = {
              id: newSessionId,
              name: cleanEqStr,
              timestamp: Date.now(),
              tree: serializeTree(newTree),
              currentNodeId: "0",
            };
            const updated = [newSession, ...sessions];
            setSavedSessions(updated);
            safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(updated));
            safeLocalStorage.setItem('algebranch_current_session_id', newSessionId);
            // Clear query parameter from the URL to prevent duplicate tabs on page refresh
            window.history.replaceState(null, '', window.location.pathname);
            return;
          } catch (err) {
            console.error('Failed to parse equation from URL query parameter:', err);
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
      }
    };

    initialize();
    setIsHydrated(true);
    // Signal global hydration so mount-time consumers (onboarding auto-resume)
    // can safely mutate persisted workspace state without clobbering it.
    setAppHydrated(true);
  }, [setTree, setCurrentNodeId, setSavedSessions, setCurrentSessionId, setLeftSidebarOpen, setRightSidebarOpen, hydrateWorkspaceTabs, createNewSession, setAppHydrated]);

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

  }, [tree, currentNodeId, currentSessionId, setSavedSessions, currentTabName]);

  const handleShare = () => {
    try {
      const eqStr = currentEq ? equationToString(currentEq) : '';
      const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      const shareUrl = eqStr ? `${baseUrl}?eq=${encodeURIComponent(eqStr)}` : baseUrl;

      navigator.clipboard.writeText(shareUrl).then(() => {
        setSharedCopied(true);
        trackEvent({
          action: 'share_link',
          category: 'interaction',
        });
        setTimeout(() => {
          setSharedCopied(false);
        }, 2000);
      });
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

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

  // Suppress the browser's automatic PWA install promotion. The app meets
  // installability criteria (manifest + service worker) but offers no real
  // offline value yet, so the unsolicited prompt is just first-run noise.
  // Calling preventDefault() silences the auto-offer while leaving manual
  // "Add to Home Screen" intact. One-line revert when offline becomes useful.
  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

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
        const data = await fetchMathScan(currentEq, sourcePath);

        if (!active) return;

        // Atomically synchronize state inside Jotai store action
        syncMathState(data);
      } catch (err) {
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
  }, [currentEq, sourcePath, syncMathState, clearMathState, setTargetPaths]);

  // Keyboard Shortcuts (Issue #17)
  useKeyboardShortcuts([
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
      description: 'Toggle Workspace',
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
      description: 'Deselect current selection',
    },
    {
      key: 's',
      meta: true,
      shift: true,
      action: () => {
        swapSides();
        trackEvent({
          action: 'shortcut_swap_sides',
          category: 'keyboard',
        });
      },
      description: 'Swap equation sides',
    },
    {
      key: 'g',
      action: () => {
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
    },
  ]);

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
      {/* Background neon grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Decorative ambient glow orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="h-16 px-4 flex items-center justify-between select-none shrink-0 w-full z-30">
        <div className="flex items-center gap-2">
          <a href="/" className="flex items-center gap-3 cursor-pointer hover:opacity-90 active:scale-98 transition-all">
            <Image
              src="/logo.png"
              alt="Algebranch Logo"
              width={36}
              height={36}
              priority
              className="h-9 w-9 object-contain rounded-full"
            />
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">Algebranch</h1>
              <p className="text-[10px] text-indigo-300 font-semibold tracking-wider uppercase">
                Interactive Algebra
              </p>
            </div>
          </a>
        </div>
        <div className="flex items-center gap-3">
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
          >
            <MessageSquarePlus size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Feedback</span>
          </button>
          <button
            onClick={handleShare}
            className={THEME_GLASS.HEADER_BUTTON}
          >
            {sharedCopied ? (
              <>
                <Check size={14} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold hidden sm:inline">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Under-header Layout (Sidebar + Main Workspace + Right Sidebar) */}
      <div className="flex-1 flex w-full overflow-hidden min-h-0 relative z-20 px-4 pb-4 pt-0">
        {/* Backdrop overlay for mobile drawers */}
        <div
          onClick={() => {
            setLeftSidebarOpen(false);
            setRightSidebarOpen(false);
          }}
          className={`fixed top-16 left-0 right-0 bottom-0 bg-neutral-950/60 backdrop-blur-sm z-35 lg:hidden transition-all duration-300 ${
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
            content={leftSidebarOpen ? "Hide Left Sidebar (W / L)" : "Show Left Sidebar (W / L)"} 
            position="right"
            wrapperClassName={`absolute top-1/2 -translate-y-1/2 z-45 w-5 h-20 transition-all duration-300 ease-in-out ${
              leftSidebarOpen ? 'left-[344px] -translate-x-1/2' : 'left-[8px] -translate-x-1/2'
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
          {isHydrated ? (
            // Keep the tab bar visible during the tutorial (incl. mobile) so a
            // user is never stranded in a tutorial workspace with no way to
            // reach other (non-tutorial) workspaces — a permanent escape hatch.
            <div className="shrink-0">
              <WorkspaceTabs />
            </div>
          ) : (
            <div className="shrink-0">
              <div className="w-full flex items-center justify-between bg-transparent px-0 pt-2 pb-0 gap-4 shrink-0 select-none">
                <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                  <div className="h-[30px] w-32 bg-white/5 border border-white/5 animate-pulse rounded-xl" />
                </div>
              </div>
            </div>
          )}
          <div className={`flex-1 flex flex-col h-full min-h-0 relative ${THEME_GLASS.PANEL} overflow-hidden`}>

            {/* 1. Active Derivation Workspace */}
            <div
              ref={activeScale.containerRef}
              onClick={() => {
                if (sourcePath !== null) {
                  setSourcePath(null);
                }
              }}
              className={`active-workspace-canvas flex-1 flex flex-col items-center justify-center min-h-0 w-full px-2 py-4 sm:p-4 lg:p-8 text-base font-light cursor-default relative group/canvas ${
                onboardingChapterId ? 'overflow-hidden' : 'overflow-auto'
              }`}
            >
              {/* Calculating Math Engine Spinner / Toast Notification */}
              {toast ? (
                <div key={`toast-${toast.key}`} className={`absolute top-4 left-4 z-30 ${THEME_GLASS.TOAST_ALERT}`}>
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span>{toast.message}</span>
                </div>
              ) : isMathLoading ? (
                <div className={`absolute top-4 left-4 z-30 ${THEME_GLASS.TOAST_LOADING}`}>
                  <div className={`h-3 w-3 border-2 ${THEME_GLASS.SPINNER}`} />
                  <span>Calculating...</span>
                </div>
              ) : null}
              {/* Contextual Action Buttons for Active Workspace */}
              {currentEq && (
                <div className="absolute top-4 right-4 z-30 contextual-actions flex items-center gap-2">
                  <Tooltip content="Clone workspace" position="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addTab();
                      }}
                      className={THEME_GLASS.ICON_BUTTON}
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
                <div className="flex flex-col items-center justify-center gap-2 origin-center">
                  <div ref={activeScale.contentRef} className="flex items-center justify-center gap-[0.4em] sm:gap-[0.6em] lg:gap-[0.8em] flex-nowrap w-max">
                    {/* LHS Term Tree */}
                    <div className="flex justify-end min-w-[1.5em] sm:min-w-[3em] lg:min-w-[5em]">
                      <EquationNode path="lhs" key={(currentEq?.lhs as unknown as { id?: string })?.id || 'lhs'} />
                    </div>

                    {/* Equals Operator sign */}
                    <span
                      ref={equalsRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (equalsLocked) return;
                        setRadialMenuOpen(!radialMenuOpen);
                      }}
                      className={`${THEME_GLASS.EQUALS_SIGN} ${
                        equalsLocked
                          ? 'cursor-default'
                          : 'cursor-pointer hover:bg-indigo-500/15 hover:border-indigo-400/35 active:scale-95'
                      }`}
                    >
                      =
                      {!!onboardingChapterId && onboardingGlobalOp && (
                        <span aria-hidden="true" className={`-inset-[0.4em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
                      )}
                    </span>

                    {/* RHS Term Tree */}
                    <div className="flex justify-start min-w-[1.5em] sm:min-w-[3em] lg:min-w-[5em]">
                      <EquationNode path="rhs" key={(currentEq?.rhs as unknown as { id?: string })?.id || 'rhs'} />
                    </div>
                  </div>
                </div>
              )}

              {/* Show Graph Floating Handle when hidden */}
              {graphSize === 'hidden' && (
                <div className="absolute right-4 bottom-4 z-35 animate-[fadeIn_0.2s_ease-out]">
                  <Tooltip content="Show variable relationship graph (G)" position="left" autoAlign={false}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGraphSize('split');
                      }}
                      className="px-3.5 py-1.5 rounded-full border border-indigo-500/35 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/10 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <TrendingUp size={14} />
                      <span>Graph</span>
                    </button>
                  </Tooltip>
                </div>
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
                  <Tooltip content="Expand graph (2/3) (G)" position="top" autoAlign={false}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (graphSize === 'split') {
                          setGraphSize('expand');
                        }
                      }}
                      disabled={graphSize === 'expand'}
                      className="p-1 hover:bg-white/10 text-white/70 hover:text-white disabled:text-white/20 disabled:hover:bg-transparent rounded-full active:scale-90 transition-all cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronUp size={14} />
                    </button>
                  </Tooltip>
                  <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                  <Tooltip content={graphSize === 'expand' ? "Shrink graph (1/3) (G)" : "Hide graph (G)"} position="top" autoAlign={false}>
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
          </div>
        </main>

        {/* Right Sidebar Edge Handle (Desktop Only) */}
        <div className="hidden lg:block">
          <Tooltip 
            content={rightSidebarOpen ? "Hide History Sidebar (H)" : "Show History Sidebar (H)"} 
            position="left"
            wrapperClassName={`absolute top-1/2 -translate-y-1/2 z-45 w-5 h-20 transition-all duration-300 ease-in-out ${
              rightSidebarOpen ? 'right-[344px] translate-x-1/2' : 'right-[8px] translate-x-1/2'
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
          <div className={`flex flex-col fixed top-16 bottom-0 right-0 z-38 transform transition-all duration-300 ease-in-out ${
            rightSidebarOpen 
              ? 'w-80 translate-x-0 opacity-100' 
              : 'w-80 translate-x-full opacity-100 max-lg:pointer-events-none'
          } lg:relative lg:top-0 lg:translate-x-0 lg:z-30 lg:flex lg:flex-col lg:h-full ${
            rightSidebarOpen 
              ? 'lg:w-80 lg:min-w-[20rem] lg:ml-4 lg:opacity-100' 
              : 'lg:w-0 lg:min-w-0 lg:ml-0 lg:opacity-0 lg:overflow-hidden lg:pointer-events-none'
          } shrink-0`}>
            <ControlPanel />
          </div>
        </div>
      </div>
      <FeedbackModal />
      <DeleteWorkspaceModal />
      <ResetHistoryModal />
      <EquationInputModal />

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
