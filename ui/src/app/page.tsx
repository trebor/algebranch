'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { EquationNode } from '../components/EquationNode';
import { PreviewEquationNode } from '../components/PreviewEquationNode';
import { Sidebar } from '../components/Sidebar';
import { ControlPanel } from '../components/ControlPanel';
import {
  currentEquationAtom,
  previewEquationAtom,
  hoverPathAtom,
  targetPathsAtom,
  hoverReducePathAtom,
  sourcePathAtom,
  syncMathStateAtom,
  historyTreeAtom,
  currentNodeIdAtom,
  HistoryNode,
  savedSessionsAtom,
  currentSessionIdAtom,
  SavedSession,
  serializeTree,
  deserializeTree,
  INITIAL_EQUATION_STRING,
} from '../store/equation';
import { THEME_GLASS, THEME_ANIMATIONS } from '../constants/theme';
import Image from 'next/image';
import { Share2, Check } from 'lucide-react';
import { Equation, parseEquation, ensureNodeIds, equationToString, serializeEquation, deserializeEquation, SerializedEquation } from 'math-engine-client';
import { useMathScale } from '../hooks/useMathScale';

// Local Constants
const API_MATH_ENDPOINT = '/api/math';

export default function Home() {
  const currentEq = useAtomValue(currentEquationAtom);
  const hoverPath = useAtomValue(hoverPathAtom);
  const targetPaths = useAtomValue(targetPathsAtom);
  const hoverReducePath = useAtomValue(hoverReducePathAtom);
  const [sourcePath, setSourcePath] = useAtom(sourcePathAtom);
  
  const [tree, setTree] = useAtom(historyTreeAtom);
  const [currentNodeId, setCurrentNodeId] = useAtom(currentNodeIdAtom);
  const [sharedCopied, setSharedCopied] = React.useState(false);
  const [savedSessions, setSavedSessions] = useAtom(savedSessionsAtom);
  const [currentSessionId, setCurrentSessionId] = useAtom(currentSessionIdAtom);

  const syncMathState = useSetAtom(syncMathStateAtom);

  const previewEq = useAtomValue(previewEquationAtom);
  const activeScale = useMathScale(currentEq);
  const previewScale = useMathScale(previewEq);

  // Load initial state on mount (Client-side only to avoid Next.js SSR hydration mismatches)
  React.useEffect(() => {
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

    // 2. Check URL query string precedence (if sharing)
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

  }, [setTree, setCurrentNodeId, setSavedSessions, setCurrentSessionId]);

  // Save derivation steps to local storage and update address bar URL reactively
  React.useEffect(() => {
    if (!tree || !currentNodeId || !tree[currentNodeId] || !currentSessionId) return;

    // 1. Save active workspace to the current session's entry in savedSessions library
    try {
      const serialized = serializeTree(tree);
      const startEq = tree["0"]?.equation;
      const sessionName = startEq ? equationToString(startEq) : INITIAL_EQUATION_STRING;

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
  }, [tree, currentNodeId, currentSessionId, setSavedSessions]);

  const handleShare = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setSharedCopied(true);
      setTimeout(() => {
        setSharedCopied(false);
      }, 2000);
    });
  };

  React.useEffect(() => {
    if (!currentEq) return;

    let active = true;
    const syncState = async () => {
      try {
        const eqStr = equationToString(currentEq);
        const serializedEq = serializeEquation(currentEq);
        const res = await fetch(API_MATH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync-state', eqStr, serializedEq, sourcePath })
        });
        const data = await res.json();

        if (!active) return;

        // Atomically synchronize state inside Jotai store action
        syncMathState(data);
      } catch (err) {
        console.error('Failed to sync math state from server:', err);
      }
    };

    syncState();
    return () => {
      active = false;
    };
  }, [currentEq, sourcePath, syncMathState]);

  // Escape key global listener to deselect/back out of active selections
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sourcePath !== null) {
        setSourcePath(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sourcePath, setSourcePath]);

  const isSpeculative = (hoverPath !== null && hoverPath in targetPaths) || hoverReducePath !== null;

  const boundingBoxRef = React.useRef<Map<string, DOMRect>>(new Map());

  React.useLayoutEffect(() => {
    const canvas = document.querySelector('.active-workspace-canvas');
    if (!canvas) return;

    const elements = Array.from(canvas.querySelectorAll('[data-flip-id]')) as HTMLElement[];
    const firstRects = boundingBoxRef.current;
    const lastRects = new Map<string, DOMRect>();

    // 1. First Pass: Capture all new positions (Last)
    elements.forEach((el) => {
      const id = el.getAttribute('data-flip-id');
      if (id) {
        lastRects.set(id, el.getBoundingClientRect());
      }
    });

    // Map to keep track of calculated translations to prevent double translation in nested structures
    const appliedTranslations = new Map<string, { dx: number; dy: number }>();

    // 2. Second Pass: Invert and Play
    elements.forEach((el) => {
      const id = el.getAttribute('data-flip-id');
      if (!id) return;

      const firstRect = firstRects.get(id);
      const lastRect = lastRects.get(id);

      if (firstRect && lastRect) {
        // Calculate viewport-space deltas
        const viewportDx = firstRect.left - lastRect.left;
        const viewportDy = firstRect.top - lastRect.top;

        if (viewportDx !== 0 || viewportDy !== 0) {
          // Find the nearest ancestor that is also active and has a stable ID
          let ancestor: HTMLElement | null = el.parentElement;
          let nearestAncestorId: string | null = null;

          while (ancestor && ancestor !== canvas) {
            const ancestorId = ancestor.getAttribute('data-flip-id');
            if (ancestorId && firstRects.has(ancestorId)) {
              nearestAncestorId = ancestorId;
              break;
            }
            ancestor = ancestor.parentElement;
          }

          // Solve the Nested Transform Problem:
          // Subtract the ancestor's translation to prevent compounding layout transforms!
          let dx = viewportDx;
          let dy = viewportDy;

          if (nearestAncestorId) {
            const ancestorTrans = appliedTranslations.get(nearestAncestorId);
            if (ancestorTrans) {
              dx -= ancestorTrans.dx;
              dy -= ancestorTrans.dy;
            }
          }

          // Store the translation we are applying to this node
          appliedTranslations.set(id, { dx: viewportDx, dy: viewportDy });

          if (dx !== 0 || dy !== 0) {
            // INVERT: Put element back to its starting position instantly
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            el.style.transition = 'none';

            // PLAY: Animate it smoothly to its new layout position
            requestAnimationFrame(() => {
              el.style.transform = '';
              el.style.transition = `transform ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms cubic-bezier(0.25, 1, 0.5, 1)`;

              // Clean up styles to restore React control after animation completes
              const cleanup = (e: TransitionEvent) => {
                if (e.propertyName === 'transform') {
                  el.style.transform = '';
                  el.style.transition = '';
                  el.removeEventListener('transitionend', cleanup);
                }
              };
              el.addEventListener('transitionend', cleanup);
            });
          }
        }
      }
    });

    // 3. Update Ref Map with current coordinates for the next render
    boundingBoxRef.current = lastRects;
  }, [currentEq]);

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(30,27,75,0.8),rgba(10,10,12,1))] text-white font-sans">
      {/* Background neon grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Decorative ambient glow orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="h-16 px-4 flex items-center justify-between select-none shrink-0 w-full z-30">
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
        <div className="flex items-center gap-3">
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
        </div>
      </header>

      {/* Under-header Layout (Sidebar + Main Workspace + Right Sidebar) */}
      <div className="flex-1 flex w-full overflow-hidden min-h-0 relative z-20 gap-4 px-4 pb-4 pt-0">
        {/* 1. Left Control Sidebar (Loader, Global Operations, Presets Library) */}
        <Sidebar />

        {/* Main workspace section */}
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          <div className={`flex-1 flex flex-col h-full min-h-0 relative ${THEME_GLASS.PANEL}`}>
            
            {/* 1. Active Derivation Workspace (Top 2/3) */}
            <div ref={activeScale.containerRef} className="active-workspace-canvas flex-[2] flex flex-col items-center justify-center min-h-0 w-full overflow-auto p-8 text-2xl md:text-3xl lg:text-[2.2rem] font-light">
              <div ref={activeScale.contentRef} className="flex flex-col items-center justify-center gap-2 origin-center">
                <div className="flex items-center justify-center gap-[0.8em] flex-nowrap max-w-full">
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
            <div ref={previewScale.containerRef} className="flex-[1] flex flex-col items-center justify-center min-h-0 w-full overflow-auto p-8 text-2xl md:text-3xl lg:text-[2.2rem] font-light">
              <div ref={previewScale.contentRef} className={`flex flex-col items-center justify-center gap-2 transition-all duration-300 origin-center ${
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
                
                <div className="flex items-center justify-center gap-[0.8em] flex-nowrap max-w-full pointer-events-none select-none">
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

        {/* Right History & Derivations Sidebar */}
        <div className="w-80 flex flex-col shrink-0">
          <ControlPanel />
        </div>
      </div>
    </div>
  );
}
