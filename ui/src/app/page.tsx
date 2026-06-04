'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { EquationNode } from '../components/EquationNode';
import { PreviewEquationNode } from '../components/PreviewEquationNode';
import { Sidebar } from '../components/Sidebar';
import { ControlPanel } from '../components/ControlPanel';
import { FeedbackModal } from '../components/FeedbackModal';
import { DeleteWorkspaceModal } from '../components/DeleteWorkspaceModal';
import { Tooltip } from '../components/Tooltip';
import { WorkspaceTabs } from '../components/WorkspaceTabs';
import {
  currentEquationAtom,
  previewEquationAtom,
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
  toastAtom,
  createNewSessionAtom,
  currentTabNameAtom,
  deleteSessionAtom,
  deleteConfirmationModalOpenAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_ANIMATIONS } from '../constants/theme';
import Image from 'next/image';
import { Share2, Check, Menu, BookOpen, ChevronLeft, ChevronRight, MessageSquarePlus, Trash2 } from 'lucide-react';
import { Equation, parseEquation, ensureNodeIds, equationToString, serializeEquation, deserializeEquation, SerializedEquation } from 'math-engine-client';
import { useMathScale } from '../hooks/useMathScale';
import { useFLIPAnimation } from '../hooks/useFLIPAnimation';
import { trackEvent } from '../utils/analytics';

// Local Constants
const API_MATH_ENDPOINT = '/api/math';

// Client-side cache for deterministic mathematical API sync states
const mathStateCache = new Map<string, any>();

export default function Home() {
  const currentEq = useAtomValue(currentEquationAtom);
  const hoverPath = useAtomValue(hoverPathAtom);
  const targetPaths = useAtomValue(targetPathsAtom);
  const hoverReducePath = useAtomValue(hoverReducePathAtom);
  const [sourcePath, setSourcePath] = useAtom(sourcePathAtom);
  const [leftSidebarOpen, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const [rightSidebarOpen, setRightSidebarOpen] = useAtom(rightSidebarOpenAtom);
  
  const [tree, setTree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const [sharedCopied, setSharedCopied] = React.useState(false);
  const [savedSessions, setSavedSessions] = useAtom(savedSessionsAtom);
  const [currentSessionId, setCurrentSessionId] = useAtom(currentSessionIdAtom);

  const syncMathState = useSetAtom(syncMathStateAtom);
  const clearMathState = useSetAtom(clearMathStateAtom);
  const setFeedbackModalOpen = useSetAtom(feedbackModalOpenAtom);
  const setFeedbackContext = useSetAtom(feedbackContextAtom);
  const [isMathLoading, setMathLoading] = useAtom(mathLoadingAtom);
  const hydrateWorkspaceTabs = useSetAtom(hydrateWorkspaceTabsAtom);
  const createNewSession = useSetAtom(createNewSessionAtom);
  const deleteSession = useSetAtom(deleteSessionAtom);
  const setDeleteConfirmationModalOpen = useSetAtom(deleteConfirmationModalOpenAtom);
  const currentTabName = useAtomValue(currentTabNameAtom);
  const [toast, setToast] = useAtom(toastAtom);

  const isSpeculative = (hoverPath !== null && hoverPath in targetPaths) || hoverReducePath !== null;
  const reduciblePaths = useAtomValue(reduciblePathsAtom);
  const previewEq = useAtomValue(previewEquationAtom);
  const activeScale = useMathScale(currentEq, [targetPaths, reduciblePaths, sourcePath]);
  const previewScale = useMathScale(previewEq, [targetPaths, reduciblePaths, sourcePath, isSpeculative]);

  useFLIPAnimation(activeScale.containerRef, currentEq);
  useFLIPAnimation(previewScale.containerRef, previewEq);

  // Load initial state on mount (Client-side only to avoid Next.js SSR hydration mismatches)
  React.useEffect(() => {
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
      const savedSessionsRaw = localStorage.getItem('algebranch_saved_sessions');
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
              name: INITIAL_EQUATION_STRING,
              timestamp: Date.now(),
              tree: serializeTree(initialTree),
              currentNodeId: "0",
            };
          }
          return s;
        });

        if (migrated) {
          localStorage.setItem('algebranch_saved_sessions', JSON.stringify(sessions));
        }

        setSavedSessions(sessions);
      }
    } catch (err) {
      console.error('Failed to load saved sessions list:', err);
    }

    // Check if we have saved tabs to prevent overwriting hydrated tab trees with stale sessions
    const hasSavedTabs = typeof window !== 'undefined' && localStorage.getItem('algebranch_workspace_tabs') !== null;
    if (hasSavedTabs) {
      const params = new URLSearchParams(window.location.search);
      const urlEq = params.get('eq');
      if (urlEq) {
        try {
          const cleanEqStr = decodeURIComponent(urlEq);
          createNewSession(cleanEqStr);
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
        localStorage.setItem('algebranch_saved_sessions', JSON.stringify(updated));
        localStorage.setItem('algebranch_current_session_id', newSessionId);
        return;
      } catch (err) {
        console.error('Failed to parse equation from URL query parameter:', err);
      }
    }
    
    // 3. Otherwise, check if there was a saved active session
    try {
      const savedSessionId = localStorage.getItem('algebranch_current_session_id');
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
        localStorage.setItem('algebranch_current_session_id', activeSession.id);
        return;
      }

      // 4. Legacy migration fallback: Check old workspace storage keys (backward compatibility)
      const savedTreeRaw = localStorage.getItem('algebranch_history_tree');
      const savedNodeId = localStorage.getItem('algebranch_current_node_id');
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
        localStorage.setItem('algebranch_saved_sessions', JSON.stringify(updated));
        localStorage.setItem('algebranch_current_session_id', legacySessionId);
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
      name: INITIAL_EQUATION_STRING,
      timestamp: Date.now(),
      tree: serializeTree(initialTree),
      currentNodeId: "0",
    };
    setSavedSessions([defaultSession]);
    localStorage.setItem('algebranch_saved_sessions', JSON.stringify([defaultSession]));
    localStorage.setItem('algebranch_current_session_id', defaultId);

  }, [setTree, setCurrentNodeId, setSavedSessions, setCurrentSessionId, setLeftSidebarOpen, setRightSidebarOpen, hydrateWorkspaceTabs, createNewSession]);

  // Save derivation steps to local storage and update address bar URL reactively
  React.useEffect(() => {
    if (!tree || !currentNodeId || !tree[currentNodeId] || !currentSessionId) return;

    // 1. Save active workspace to the current session's entry in savedSessions library
    try {
      const serialized = serializeTree(tree);
      const sessionName = currentTabName || INITIAL_EQUATION_STRING;

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
        localStorage.setItem('algebranch_saved_sessions', JSON.stringify(nextSessions));
        return nextSessions;
      });

      // Also maintain the legacy/single active workspace key for other references
      localStorage.setItem('algebranch_history_tree', JSON.stringify(serialized));
      localStorage.setItem('algebranch_current_node_id', currentNodeId);
      localStorage.setItem('algebranch_current_session_id', currentSessionId);
    } catch (err) {
      console.error('Failed to save history to local storage:', err);
    }

    // 2. Update address bar URL query parameter reactively
    try {
      const currentEqVal = tree[currentNodeId].equation;
      const eqStr = equationToString(currentEqVal);
      const params = new URLSearchParams(window.location.search);
      if (params.get('eq') !== eqStr) {
        params.set('eq', eqStr);
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      }
    } catch (err) {
      console.error('Failed to update URL search parameter:', err);
    }
  }, [tree, currentNodeId, currentSessionId, setSavedSessions, currentTabName]);

  const handleShare = () => {
    const shareUrl = window.location.href;
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
  };

  // Register PWA Service Worker on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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
    }
  }, []);

  React.useEffect(() => {
    if (!currentEq) return;

    // Clear old interactive paths/actions immediately during transition to prevent stale highlights/handles
    clearMathState();

    let active = true;
    const syncState = async () => {
      try {
        setMathLoading(true);
        const eqStr = equationToString(currentEq);
        const serializedEq = serializeEquation(currentEq);
        
        // Generate a cache key based on the deterministic calculation inputs
        const cacheKey = JSON.stringify({ eqStr, serializedEq, sourcePath });
        const cachedData = mathStateCache.get(cacheKey);
        
        if (cachedData) {
          if (active) {
            syncMathState(cachedData);
          }
          return;
        }

        const res = await fetch(API_MATH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync-state', eqStr, serializedEq, sourcePath })
        });
        const data = await res.json();

        if (!active) return;

        // Store response in cache for instant sub-millisecond retrieval on repeat visits/history navigation
        mathStateCache.set(cacheKey, data);

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
  }, [currentEq, sourcePath, syncMathState, clearMathState]);

  // Escape key global listener to deselect/back out of active selections and close mobile drawers
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (leftSidebarOpen) {
          setLeftSidebarOpen(false);
        } else if (rightSidebarOpen) {
          setRightSidebarOpen(false);
        } else if (sourcePath !== null) {
          setSourcePath(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sourcePath, setSourcePath, leftSidebarOpen, rightSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen]);

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


  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(30,27,75,0.8),rgba(10,10,12,1))] text-white font-sans">
      {/* Background neon grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Decorative ambient glow orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="h-16 px-4 flex items-center justify-between select-none shrink-0 w-full z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className="lg:hidden p-2 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
            aria-label="Toggle operations sidebar"
          >
            <Menu size={20} />
          </button>
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/10 text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 hover:border-indigo-500/35 cursor-pointer shadow-md transition-all duration-300 relative group"
          >
            <MessageSquarePlus size={13} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>Feedback</span>
          </button>
          <button
            onClick={handleShare}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/10 text-xs font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 hover:border-indigo-500/35 cursor-pointer shadow-md transition-all duration-300 relative group`}
          >
            {sharedCopied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 size={13} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Share</span>
              </>
            )}
          </button>
          <button
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className="lg:hidden p-2 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
            aria-label="Toggle history panel"
          >
            <BookOpen size={20} />
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
            (leftSidebarOpen || rightSidebarOpen)
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* 1. Left Control Sidebar (Loader, Global Operations, Presets Library) */}
        <Sidebar />

        {/* Left Sidebar Edge Handle (Desktop Only) */}
        <button
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-45 items-center justify-center w-5 h-20 rounded-full border border-white/10 bg-neutral-900/60 backdrop-blur-md text-white/50 hover:text-indigo-300 hover:bg-indigo-600/20 hover:border-indigo-500/50 shadow-lg shadow-black/40 transition-all duration-300 ease-in-out cursor-pointer hover:scale-105 active:scale-95 ${
            leftSidebarOpen ? 'left-[344px] -translate-x-1/2' : 'left-[8px] -translate-x-1/2'
          }`}
          aria-label={leftSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {leftSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Main workspace section */}
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden gap-3">
          <WorkspaceTabs />
          <div className={`flex-1 flex flex-col h-full min-h-0 relative ${THEME_GLASS.PANEL}`}>
            
            {/* 1. Active Derivation Workspace (Top 2/3) */}
            <div
              ref={activeScale.containerRef}
              onClick={() => {
                if (sourcePath !== null) {
                  setSourcePath(null);
                }
              }}
              className="active-workspace-canvas flex-[2] flex flex-col items-center justify-center min-h-0 w-full overflow-auto p-8 text-2xl md:text-3xl lg:text-[2.2rem] font-light cursor-default relative group/canvas"
            >
              {/* Calculating Math Engine Spinner / Toast Notification */}
              {toast ? (
                <div key={`toast-${toast.key}`} className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/25 bg-neutral-900/80 backdrop-blur-md text-xs text-indigo-300 font-semibold select-none shadow-lg shadow-black/20 animate-[fadeIn_0.2s_ease-out]">
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span>{toast.message}</span>
                </div>
              ) : isMathLoading ? (
                <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-neutral-900/60 backdrop-blur-md text-xs text-indigo-300 font-semibold select-none shadow-lg shadow-black/20 animate-[fadeIn_0.2s_ease-out]">
                  <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping shrink-0" />
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-500/20 border-t-indigo-400 shrink-0" />
                  <span>Calculating...</span>
                </div>
              ) : null}
              {/* Contextual Action Buttons for Active Workspace */}
              {currentEq && (
                <div className="absolute top-4 right-4 z-30 contextual-actions flex items-center gap-2">
                  <Tooltip content="Report an issue with this active equation" position="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFeedbackContext(`Active Equation: ${equationToString(currentEq)}`);
                        setFeedbackModalOpen(true);
                      }}
                      className="p-2 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-neutral-900/90 text-white/40 hover:text-indigo-400 hover:border-indigo-500/30 transition-all cursor-pointer shadow-md"
                    >
                      <MessageSquarePlus size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete workspace permanently" position="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmationModalOpen(true);
                      }}
                      disabled={savedSessions.length <= 1}
                      className="p-2 rounded-xl border border-white/5 bg-neutral-900/60 hover:bg-red-500/10 text-white/40 hover:text-red-400 hover:border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                </div>
              )}
              <div className="flex flex-col items-center justify-center gap-2 origin-center">
                <div ref={activeScale.contentRef} className="flex items-center justify-center gap-[0.8em] flex-nowrap w-max">
                  {/* LHS Term Tree */}
                  <div className="flex justify-end min-w-[5em]">
                    <EquationNode path="lhs" key={(currentEq?.lhs as unknown as { id?: string })?.id || 'lhs'} />
                  </div>

                  {/* Equals Operator sign */}
                  <span className="text-[1.2em] font-light font-mono text-indigo-400 select-none px-[0.6em] py-[0.2em] bg-indigo-500/5 border border-indigo-500/10 rounded-[0.4em] shadow-inner shadow-black">
                    =
                  </span>

                  {/* RHS Term Tree */}
                  <div className="flex justify-start min-w-[5em]">
                    <EquationNode path="rhs" key={(currentEq?.rhs as unknown as { id?: string })?.id || 'rhs'} />
                  </div>
                </div>
              </div>
            </div>

            {/* Elegant Dashed Separator */}
            <div className="w-11/12 border-t border-dashed border-white/10 shrink-0 self-center" />

            {/* 2. Speculative Preview Workspace (Bottom 1/3) */}
            <div
              ref={previewScale.containerRef}
              onClick={() => {
                if (sourcePath !== null) {
                  setSourcePath(null);
                }
              }}
              className="flex-[1] flex flex-col items-center justify-center min-h-0 w-full overflow-auto p-8 text-2xl md:text-3xl lg:text-[2.2rem] font-light cursor-default relative group/preview"
            >

              <div className={`flex flex-col items-center justify-center gap-2 transition-all duration-300 origin-center ${
                isSpeculative ? 'opacity-70 scale-100' : 'opacity-30 scale-95'
              }`}>
                <span className={`text-[10px] font-semibold tracking-wider uppercase select-none flex items-center gap-1.5 transition-colors duration-300 ${
                  isSpeculative ? 'text-emerald-400' : 'text-zinc-500'
                }`}>
                  <span>Preview</span>
                  {isSpeculative && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  )}
                </span>
                
                <div ref={previewScale.contentRef} className="flex items-center justify-center gap-[0.8em] flex-nowrap w-max pointer-events-none select-none">
                  {/* LHS Preview Term Tree */}
                  <div className="flex justify-end min-w-[5em]">
                    <PreviewEquationNode path="lhs" />
                  </div>

                  {/* Equals Operator sign */}
                  <span className={`text-[1.2em] font-light font-mono select-none px-[0.6em] py-[0.2em] border rounded-[0.4em] transition-all duration-300 ${
                    isSpeculative
                      ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                      : 'text-zinc-600 border-zinc-500/10 bg-zinc-500/5'
                  }`}>
                    =
                  </span>

                  {/* RHS Preview Term Tree */}
                  <div className="flex justify-start min-w-[5em]">
                    <PreviewEquationNode path="rhs" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar Edge Handle (Desktop Only) */}
        <button
          onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-45 items-center justify-center w-5 h-20 rounded-full border border-white/10 bg-neutral-900/60 backdrop-blur-md text-white/50 hover:text-indigo-300 hover:bg-indigo-600/20 hover:border-indigo-500/50 shadow-lg shadow-black/40 transition-all duration-300 ease-in-out cursor-pointer hover:scale-105 active:scale-95 ${
            rightSidebarOpen ? 'right-[344px] translate-x-1/2' : 'right-[8px] translate-x-1/2'
          }`}
          aria-label={rightSidebarOpen ? "Close history" : "Open history"}
        >
          {rightSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

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
      <FeedbackModal />
      <DeleteWorkspaceModal />
    </div>
  );
}
