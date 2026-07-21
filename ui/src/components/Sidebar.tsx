// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { useIsHydrated } from '../hooks/useIsHydrated';
import { Tooltip } from './Tooltip';
import { HotkeyHint } from './HotkeyHint';
import { TooltipCard } from './TooltipCard';
import { Equation, parseEquation, ensureNodeIds } from 'math-engine-client';
import { CATEGORY_DESCRIPTIONS } from '../constants/presets';
import {
  resetToEquationStringAtom,
  savedSessionsAtom,
  currentSessionIdAtom,
  loadSessionAtom,
  presetCategoriesAtom,
  presetSearchQueryAtom,
  leftSidebarOpenAtom,
  equationInputModalOpenAtom,
  onboardingShowDirectoryAtom,
  SavedSession,
  deserializeNodeEquation,
  settingsAtom,
  toastAtom,
  getPresetMismatchedSettings,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import { PRACTICE_SETS } from '../constants/ladders';
import { practiceSetProgressAtom, activePracticeSetAtom, startPracticeSetAtom } from '../store/ladders';
import { ShieldAlert, X, Play, FolderGit2, ChevronDown, ChevronRight, Triangle, TriangleAlert, Activity, Library, Search, LayoutGrid, PenTool, BookOpen, Target, GraduationCap } from 'lucide-react';
import {
  RovingTabindexProvider,
  useRovingItem,
  useOptionalRovingTabindex,
} from '../hooks/useRovingTabindex';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Practice Problems':
      return <Library size={11} className="text-blue-400 shrink-0" />;
    case 'Formulas & Laws':
      return <Triangle size={11} className="text-teal-400 shrink-0" />;
    case 'Algebraic Identities':
      return <Activity size={11} className="text-amber-400 shrink-0" />;
    default:
      return <FolderGit2 size={11} className="text-indigo-400 shrink-0" />;
  }
};

const formatTimestamp = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getStepCount = (tree: Record<string, unknown> | undefined | null): number => {
  if (!tree) return 0;
  return Math.max(0, Object.keys(tree).length - 1);
};

interface SidebarContentProps {
  onCloseMobile?: () => void;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
  onCloseMobile,
}) => {
  const [, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);

  const savedSessions = useAtomValue(savedSessionsAtom);
  const currentSessionId = useAtomValue(currentSessionIdAtom);
  const currentSession = savedSessions.find(s => s.id === currentSessionId);
  const loadSession = useSetAtom(loadSessionAtom);

  const setIsInputModalOpen = useSetAtom(equationInputModalOpenAtom);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isMobileRecentsOpen, setIsMobileRecentsOpen] = React.useState(false);
  const mounted = useIsHydrated();

  const recentsTriggerRef = React.useRef<HTMLButtonElement>(null);

  const handleRecentsClick = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    if (isMobile) {
      setIsMobileRecentsOpen(true);
    } else {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  // Close the Saved-Workspaces dropdown / mobile sheet on Escape and return
  // focus to its trigger, matching the dialogs' keyboard-dismiss behavior.
  React.useEffect(() => {
    if (!isDropdownOpen && !isMobileRecentsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsDropdownOpen(false);
      setIsMobileRecentsOpen(false);
      recentsTriggerRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen, isMobileRecentsOpen]);



  // Single source of truth for a workspace's tooltip so the dropdown trigger and
  // its list items render identically.
  const sessionTooltipCard = (session: SavedSession) => {
    let eq: Equation | null = null;
    try {
      const node = session.tree?.[session.currentNodeId] || session.tree?.['0'];
      if (node) eq = deserializeNodeEquation(node.equation);
    } catch {
      eq = null;
    }
    const steps = getStepCount(session.tree);
    return (
      <TooltipCard
        eyebrow={session.chapterId ? 'Tutorial Workspace' : 'Workspace'}
        meta={`${steps} ${steps === 1 ? 'step' : 'steps'}`}
        title={session.name}
        equation={eq}
        footer={<span>{formatTimestamp(session.timestamp)}</span>}
      />
    );
  };

  const triggerTooltipContent = currentSession ? sessionTooltipCard(currentSession) : null;

  return (
    <div className="shrink-0 flex flex-col gap-3">
      {/* Header (Desktop Only) */}
      <div className={`hidden xl:flex items-center justify-between ${THEME_GLASS.PANEL_HEADER} shrink-0`}>
        <Tooltip content={<HotkeyHint label="Toggle Workspace" keys="W" />} position="right" autoAlign={false}>
          <h2 
            onClick={() => setLeftSidebarOpen(false)}
            className="text-lg font-bold text-white flex items-center gap-2 select-none cursor-pointer hover:text-indigo-200 transition-colors"
          >
            <LayoutGrid className="text-indigo-400" size={18} />
            <span>Workspace</span>
          </h2>
        </Tooltip>
      </div>

      {/* Recessed Content Box */}
      <div className={`p-4 flex flex-col gap-4 ${THEME_GLASS.TREE_BG}`}>
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className={`text-xs ${THEME_GLASS.TEXT_MUTED} tracking-wider font-semibold select-none`}>
            Define Equation
          </span>
          <Tooltip content={<HotkeyHint label="Enter equation in new workspace" keys="N" />} position="bottom" autoAlign={false} wrapperClassName="w-full">
            <button
              type="button"
              onClick={() => {
                setIsInputModalOpen(true);
                onCloseMobile?.();
              }}
              className={`w-full h-9 px-3 text-xs font-bold flex items-center justify-center gap-1.5 ${THEME_GLASS.BUTTON_PRIMARY}`}
            >
              <PenTool size={12} />
              <span>New Equation</span>
            </button>
          </Tooltip>
        </div>

        {/* Recents Dropdown Selector Section */}
        <div className={`flex flex-col gap-1.5 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-3 shrink-0`}>
          <span className={`text-xs ${THEME_GLASS.TEXT_MUTED} tracking-wider font-semibold select-none`}>
            Saved Workspaces
          </span>
          <div className="relative w-full">
            {savedSessions.length > 0 ? (
              <>
                {!isDropdownOpen && currentSession ? (
                  <Tooltip
                    content={triggerTooltipContent}
                    className="max-w-[min(92vw,40rem)]"
                    wrapperClassName="w-full min-w-0"
                  >
                    <button
                      ref={recentsTriggerRef}
                      type="button"
                      onClick={handleRecentsClick}
                      className={`w-full h-8 px-3 text-xs flex items-center justify-between gap-2 min-w-0 ${THEME_GLASS.FIELD_SELECT}`}
                    >
                      <span className="truncate flex-1 text-left font-semibold">
                        {currentSession.name}
                      </span>
                      <ChevronDown size={12} className={`${THEME_GLASS.TEXT_MUTED} transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    ref={recentsTriggerRef}
                    type="button"
                    onClick={handleRecentsClick}
                    className={`w-full h-8 px-3 text-xs flex items-center justify-between gap-2 min-w-0 ${THEME_GLASS.FIELD_SELECT}`}
                  >
                    <span className="truncate flex-1 text-left">
                      {currentSession?.name || 'Select workspace...'}
                    </span>
                    <ChevronDown size={12} className={`${THEME_GLASS.TEXT_MUTED} transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setIsDropdownOpen(false)} 
                    />
                    <div className={`absolute left-0 right-0 mt-1.5 overflow-y-auto max-h-60 z-50 py-1 animate-[fadeIn_0.15s_ease-out] ${THEME_GLASS.OVERLAY_BG}`}>
                      {[...savedSessions]
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map((session) => {
                          const isActive = session.id === currentSessionId;
                          const stepCount = getStepCount(session.tree);
                          return (
                            <Tooltip
                              key={session.id}
                              content={sessionTooltipCard(session)}
                              position="right"
                              autoAlign={false}
                              className="max-w-[min(92vw,40rem)]"
                              wrapperClassName="w-full"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  loadSession(session.id);
                                  trackEvent({
                                    action: 'load_session',
                                    category: 'presets',
                                    label: session.id,
                                  });
                                  setIsDropdownOpen(false);
                                  if (window.innerWidth < 1024) {
                                    setLeftSidebarOpen(false);
                                  }
                                  onCloseMobile?.();
                                }}
                                className={`w-full text-left px-3 py-2 text-xs flex justify-between items-center gap-4 ${THEME_GLASS.LIST_ITEM_HOVER} cursor-pointer ${
                                  isActive ? THEME_GLASS.LIST_ITEM_ACTIVE : THEME_GLASS.TEXT_MUTED_BRIGHT
                                }`}
                              >
                                <span className="truncate font-mono flex-1">
                                  {session.name}
                                </span>
                                <span className={`text-xs ${THEME_GLASS.TEXT_MUTED_EXTRA} whitespace-nowrap font-sans shrink-0 flex items-center gap-1.5`}>
                                  <span>{stepCount} {stepCount === 1 ? 'step' : 'steps'}</span>
                                  <span>·</span>
                                  <span>{formatTimestamp(session.timestamp)}</span>
                                </span>
                              </button>
                            </Tooltip>
                          );
                        })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <button
                type="button"
                disabled
                className={`w-full h-8 px-3 text-xs flex items-center justify-between gap-2 min-w-0 ${THEME_GLASS.BUTTON_SECONDARY_MUTED}`}
              >
                <span className="truncate flex-1 text-left">
                  No recent workspaces
                </span>
                <ChevronDown size={12} className={`${THEME_GLASS.TEXT_MUTED_EXTRA} shrink-0`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {isMobileRecentsOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div className={`fixed inset-0 z-50 flex flex-col p-6 pb-[env(safe-area-inset-bottom)] animate-[fadeIn_0.2s_ease-out] ${THEME_GLASS.OVERLAY_MOBILE}`}>
          {/* Header */}
          <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER} pb-4 mb-6`}>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 select-none">
                <FolderGit2 className="text-indigo-400" size={16} />
                <span>Select Workspace</span>
              </h2>
              <p className={`text-xs ${THEME_GLASS.TEXT_MUTED} mt-1 tracking-wider font-semibold`}>Explore and select a recent workspace</p>
            </div>
            <button
              onClick={() => setIsMobileRecentsOpen(false)}
              className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER} hover:bg-white/5 text-white/50 hover:text-white transition-colors cursor-pointer`}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content - Scrollable List */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
            {[...savedSessions]
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((session) => {
                const isActive = session.id === currentSessionId;
                const stepCount = getStepCount(session.tree);
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      loadSession(session.id);
                      trackEvent({
                        action: 'load_session',
                        category: 'presets',
                        label: session.id,
                      });
                      setIsMobileRecentsOpen(false);
                      if (window.innerWidth < 1024) {
                        setLeftSidebarOpen(false);
                      }
                      onCloseMobile?.();
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center gap-4 cursor-pointer hover:scale-[1.01] active:scale-98 duration-150 ${
                      isActive 
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-semibold' 
                        : `border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-[#16142a]/30 hover:bg-[#16142a]/60 ${THEME_GLASS.TEXT_MUTED_LIGHT} hover:text-white`
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-mono text-xs truncate text-indigo-50">
                        {session.name}
                      </div>
                      <div className={`text-xs ${THEME_GLASS.TEXT_MUTED} mt-1 flex items-center gap-1.5 font-sans`}>
                        <span>{stepCount} {stepCount === 1 ? 'step' : 'steps'}</span>
                        <span>·</span>
                        <span>{formatTimestamp(session.timestamp)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {isActive ? (
                        <span className={`text-[0.5625rem] font-sans font-bold tracking-wider px-2.5 py-0.5 ${THEME_GLASS.ACTIVE_BADGE}`}>
                          Active
                        </span>
                      ) : (
                        <ChevronRight size={14} className={THEME_GLASS.TEXT_MUTED_EXTRA} />
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const RovingLibraryButton = ({
  itemKey,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { itemKey: string }) => {
  const { ref, tabIndex } = useRovingItem(itemKey);
  const ctx = useOptionalRovingTabindex();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!ctx) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        ctx.moveFocus('next');
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        ctx.moveFocus('prev');
        break;
      case 'Home':
        e.preventDefault();
        ctx.moveFocus('first');
        break;
      case 'End':
        e.preventDefault();
        ctx.moveFocus('last');
        break;
      default:
        props.onKeyDown?.(e);
    }
  };

  return (
    <button
      {...props}
      ref={ref as React.RefCallback<HTMLButtonElement>}
      tabIndex={tabIndex}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  );
};

interface LearnPracticeContentProps {
  onCloseMobile?: () => void;
  showHeader?: boolean;
}

export const LearnPracticeContent: React.FC<LearnPracticeContentProps> = ({
  onCloseMobile,
  showHeader = false,
}) => {
  const [, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const setOnboardingShowDirectory = useSetAtom(onboardingShowDirectoryAtom);
  const activePracticeSet = useAtomValue(activePracticeSetAtom);
  const practiceProgress = useAtomValue(practiceSetProgressAtom);
  const startPracticeSet = useSetAtom(startPracticeSetAtom);
  const [expandedPracticeSets, setExpandedPracticeSets] = React.useState(false);

  return (
    <div className="shrink-0 flex flex-col gap-3">
      {showHeader && (
        <div className={`hidden xl:flex items-center justify-between ${THEME_GLASS.PANEL_HEADER} shrink-0`}>
          <Tooltip content={<HotkeyHint label="Toggle Learn & Practice" keys="Shift+P" />} position="right" autoAlign={false}>
            <h2 
              onClick={() => setLeftSidebarOpen(false)}
              className="text-lg font-bold text-white flex items-center gap-2 select-none cursor-pointer hover:text-indigo-200 transition-colors"
            >
              <GraduationCap className="text-indigo-400" size={18} />
              <span>Learn &amp; Practice</span>
            </h2>
          </Tooltip>
        </div>
      )}

      {/* Recessed Content Box */}
      <RovingTabindexProvider>
        <div className={`p-4 flex flex-col gap-3 ${THEME_GLASS.TREE_BG}`}>
          {/* Interactive Tutorials Entry */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <Tooltip
              content={(
                <TooltipCard
                  eyebrow="Tutorials"
                  title="Interactive Tutorials"
                  description="Guided, interactive chapter workspaces designed to teach step-by-step app mechanics and features."
                  footer={<span className="text-zinc-400">Select a chapter from the directory modal to begin.</span>}
                />
              )}
              position="right"
              autoAlign={false}
              wrapperClassName="w-full"
              className="max-w-[min(92vw,24rem)]"
            >
              <RovingLibraryButton
                itemKey="cat-tutorials"
                onClick={() => {
                  setOnboardingShowDirectory(true);
                  if (window.innerWidth < 1024) {
                    setLeftSidebarOpen(false);
                  }
                  onCloseMobile?.();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/10 bg-neutral-900/60 hover:bg-neutral-800/90 hover:border-indigo-500/30 text-white transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30 transition-all">
                    <BookOpen size={14} className="text-indigo-400 shrink-0" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-white group-hover:text-indigo-200 transition-colors">Interactive Tutorials</span>
                    <span className="text-[0.625rem] text-white/50 font-medium">Guided Chapters</span>
                  </div>
                </div>
                <span className="text-[0.625rem] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 group-hover:text-white transition-colors">
                  Open
                </span>
              </RovingLibraryButton>
            </Tooltip>
          </div>

          {/* Practice Sets Entry */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <Tooltip
              content={(
                <TooltipCard
                  eyebrow="Practice Sets"
                  meta={`${PRACTICE_SETS.length} sets`}
                  title="Practice Sets"
                  description="Curated problem progressions of five to eight problems each, designed to build step-by-step algebraic fluency and retention."
                  footer={<span className="text-zinc-400">Starts at saved position &amp; advances automatically upon solving.</span>}
                />
              )}
              position="right"
              autoAlign={false}
              wrapperClassName="w-full"
              className="max-w-[min(92vw,24rem)]"
            >
              <RovingLibraryButton
                itemKey="cat-practice-sets"
                onClick={() => setExpandedPracticeSets((prev) => !prev)}
                className={`w-full flex items-center justify-between py-2 px-3 text-xs font-bold tracking-wider ${THEME_GLASS.CATEGORY_HEADER}`}
              >
                <div className="flex items-center gap-2">
                  <span className={THEME_GLASS.TEXT_MUTED}>
                    {expandedPracticeSets ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Target size={11} className="text-emerald-400 shrink-0" />
                    <span>Practice Sets</span>
                  </div>
                </div>
                <span className={`text-[0.5625rem] font-sans font-semibold px-2 py-0.5 group-hover:text-white ${THEME_GLASS.BADGE_MUTED}`}>
                  {PRACTICE_SETS.length}
                </span>
              </RovingLibraryButton>
            </Tooltip>

            {expandedPracticeSets && (
              <div className={`flex flex-col gap-2 pl-2 border-l ${THEME_GLASS.PANEL_BORDER_SUBTLE} ml-3 mt-1.5 animate-[fadeIn_0.2s_ease-out]`}>
                {PRACTICE_SETS.map((set) => {
                  const isCompleted = practiceProgress.completedSetIds.includes(set.id);
                  const pos = practiceProgress.setPositions[set.id] ?? 0;
                  const isActive = activePracticeSet?.set.id === set.id;
                  const total = set.presetIds.length;
                  const percent = Math.min(100, Math.round(((isCompleted ? total : pos) / total) * 100));

                  return (
                    <Tooltip
                      key={set.id}
                      interactive={true}
                      position="right"
                      autoAlign={false}
                      wrapperClassName="w-full"
                      className="max-w-[min(92vw,24rem)]"
                      content={(
                        <TooltipCard
                          eyebrow="Practice Set"
                          title={`${pos > 0 || isCompleted ? 'Continue' : 'Start'} ${set.title}`}
                          description={set.description}
                          meta={`${total} problems`}
                          footer={
                            <div className="flex items-center justify-between text-xs w-full">
                              <span className={THEME_GLASS.TEXT_MUTED}>Progress</span>
                              <span className={isCompleted ? 'text-emerald-400 font-bold' : 'text-indigo-300 font-bold'}>
                                {isCompleted ? 'Completed ✓' : `${pos} of ${total} solved`}
                              </span>
                            </div>
                          }
                        />
                      )}
                    >
                      <RovingLibraryButton
                        itemKey={`practice-set-${set.id}`}
                        onClick={() => {
                          startPracticeSet({ setId: set.id });
                          if (window.innerWidth < 1024) {
                            setLeftSidebarOpen(false);
                          }
                          onCloseMobile?.();
                        }}
                        className={`w-full flex flex-col gap-1 text-left p-2.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                          isActive
                            ? 'border-indigo-500/50 bg-indigo-950/40 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                            : `border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-[#16142a]/30 hover:bg-[#16142a]/60 text-zinc-300 hover:text-white`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold truncate text-white">{set.title}</span>
                          <span
                            className={`text-[0.5625rem] font-sans font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isCompleted
                                ? THEME_GLASS.ACTIVE_BADGE
                                : isActive
                                ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-400/30'
                                : THEME_GLASS.BADGE_MUTED
                            }`}
                          >
                            {isCompleted ? 'Completed ✓' : `${pos}/${total}`}
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isCompleted ? 'bg-emerald-400' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </RovingLibraryButton>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </RovingTabindexProvider>
    </div>
  );
};

export const PracticeSetsContent = LearnPracticeContent;

interface EquationLibraryContentProps {
  onCloseMobile?: () => void;
  showHeader?: boolean;
}export const EquationLibraryContent: React.FC<EquationLibraryContentProps> = ({
  onCloseMobile,
  showHeader = false,
}) => {
  const [, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);
  const presetCategories = useAtomValue(presetCategoriesAtom);
  const [searchQuery, setSearchQuery] = useAtom(presetSearchQueryAtom);
  const isSearching = searchQuery.trim().length > 0;
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});
  const [expandedSubcategories, setExpandedSubcategories] = React.useState<Record<string, boolean>>({});
  const [errorStr, setErrorStr] = React.useState<string | null>(null);
  const [settings, setSettings] = useAtom(settingsAtom);
  const setToast = useSetAtom(toastAtom);

  // Pre-parse category example equations for the category header tooltips
  const parsedCategoryExamples = React.useMemo(() => {
    const map: Record<string, Equation | null> = {};
    for (const [cat, info] of Object.entries(CATEGORY_DESCRIPTIONS)) {
      try {
        map[cat] = ensureNodeIds(parseEquation(info.example));
      } catch {
        map[cat] = null;
      }
    }
    return map;
  }, []);

  // Pre-parse each preset's equation once so the hover tooltip can render it in
  // pretty (typeset) form without re-parsing on every render. Unparseable
  // presets fall back to their raw string in the tooltip.
  const parsedPresets = React.useMemo(() => {
    const map: Record<string, Equation | null> = {};
    for (const group of presetCategories) {
      for (const subcat of group.subcategories) {
        for (const preset of subcat.presets) {
          try {
            map[preset.id] = ensureNodeIds(parseEquation(preset.equation));
          } catch {
            map[preset.id] = null;
          }
        }
      }
    }
    return map;
  }, [presetCategories]);

  const toggleCategory = (categoryName: string, targetEl?: HTMLElement | null) => {
    setExpandedSubcategories({});
    setExpandedCategories((prev) => {
      const wasExpanded = !!prev[categoryName];
      if (wasExpanded) {
        return {};
      } else {
        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
        return { [categoryName]: true };
      }
    });
  };

  const toggleSubcategory = (subcatKey: string, targetEl?: HTMLElement | null) => {
    setExpandedSubcategories((prev) => {
      const wasExpanded = !!prev[subcatKey];
      if (wasExpanded) {
        return {};
      } else {
        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
        return { [subcatKey]: true };
      }
    });
  };

  const handlePresetSelect = (eqStr: string, label: string) => {
    try {
      setErrorStr(null);
      resetToEquation(eqStr, label);
      trackEvent({
        action: 'load_preset',
        category: 'presets',
        label: label,
      });
      if (window.innerWidth < 1024) {
        setLeftSidebarOpen(false);
      }
      onCloseMobile?.();
    } catch (err) {
      setErrorStr(`Error loading equation: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Header */}
      {showHeader && (
        <div className={`hidden xl:flex items-center justify-between ${THEME_GLASS.PANEL_HEADER} shrink-0`}>
          <Tooltip content={<HotkeyHint label="Toggle Equation Library" keys="L" />} position="right" autoAlign={false}>
            <h2 
              onClick={() => setLeftSidebarOpen(false)}
              className="text-lg font-bold text-white flex items-center gap-2 select-none cursor-pointer hover:text-indigo-200 transition-colors"
            >
              <Library className="text-indigo-400" size={18} />
              <span>Equation Library</span>
            </h2>
          </Tooltip>
        </div>
      )}

      {errorStr && (
        <div className={`flex items-start gap-2 text-xs p-2 animate-[fadeIn_0.2s_ease-out] shrink-0 ${THEME_GLASS.BUTTON_DANGER}`}>
          <ShieldAlert size={12} className="shrink-0 mt-0.5" />
          <span className="break-all">{errorStr}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative shrink-0">
        <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${THEME_GLASS.TEXT_MUTED}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setSearchQuery('');
            }
          }}
          placeholder="Search the library…"
          aria-label="Search equation library"
          className={`w-full text-xs py-2 pl-8 pr-8 ${THEME_GLASS.FIELD_INPUT}`}
        />
        {isSearching && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${THEME_GLASS.TEXT_MUTED} hover:text-white`}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Recessed Content Box */}
      <RovingTabindexProvider>
        <div id="library-region" className={`flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 ${THEME_GLASS.TREE_BG}`}>
          {presetCategories.length === 0 && (
            <div className={`flex flex-col items-center justify-center gap-1 py-10 text-center select-none ${THEME_GLASS.TEXT_MUTED}`}>
              <Search size={20} className="opacity-50" />
              <span className="text-xs">No equations match “{searchQuery.trim()}”.</span>
            </div>
          )}
          {presetCategories.map((group) => {
            // While searching, every matching category is open so results are
            // visible without manual expansion.
            const isExpanded = isSearching || !!expandedCategories[group.category];
            const catInfo = CATEGORY_DESCRIPTIONS[group.category];
            const presetCount = group.subcategories.reduce((acc, sub) => acc + sub.presets.length, 0);

            // Category header — hovering previews category description and typeset example equation
            const categoryHeader = (
              <RovingLibraryButton
                itemKey={`cat-${group.category}`}
                onClick={(e) => toggleCategory(group.category, e.currentTarget as HTMLElement)}
                className={`w-full flex items-center justify-between py-2 px-3 text-xs font-bold tracking-wider ${THEME_GLASS.CATEGORY_HEADER}`}
              >
                <div className="flex items-center gap-2">
                  <span className={THEME_GLASS.TEXT_MUTED}>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getCategoryIcon(group.category)}
                    <span>{group.category}</span>
                  </div>
                </div>
                <span className={`text-[0.5625rem] font-sans font-semibold px-2 py-0.5 group-hover:text-white ${THEME_GLASS.BADGE_MUTED}`}>
                  {presetCount}
                </span>
              </RovingLibraryButton>
            );
            return (
              <div key={group.category} className="flex flex-col gap-1.5 mb-1.5 shrink-0">
                {/* Category Header */}
                {catInfo ? (
                  <Tooltip
                    content={(
                      <TooltipCard
                        eyebrow="Category"
                        title={`${group.category}, like:`}
                        description={catInfo.description}
                        equation={parsedCategoryExamples[group.category]}
                      />
                    )}
                    position="right"
                    autoAlign={false}
                    wrapperClassName="w-full"
                    className="max-w-[min(92vw,24rem)]"
                  >
                    {categoryHeader}
                  </Tooltip>
                ) : categoryHeader}

                {/* Category Items (Collapsible Subcategories) */}
                {isExpanded && (
                  <div className={`flex flex-col gap-2 pl-2 border-l ${THEME_GLASS.PANEL_BORDER_SUBTLE} ml-3 mt-1.5 animate-[fadeIn_0.2s_ease-out]`}>
                    {group.subcategories.map((sub) => {
                      const subcatKey = `${group.category}-${sub.subcategory}`;
                      const isSubExpanded = isSearching || !!expandedSubcategories[subcatKey];

                      return (
                        <div key={sub.subcategory} className="flex flex-col gap-1 shrink-0">
                          {/* Subcategory Accordion Header */}
                          <RovingLibraryButton
                            itemKey={`subcat-${subcatKey}`}
                            onClick={(e) => toggleSubcategory(subcatKey, e.currentTarget as HTMLElement)}
                            className="w-full flex items-center justify-between py-1.5 px-2 text-[0.7rem] font-bold tracking-wider rounded-md transition-colors hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-500">
                                {isSubExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                              </span>
                              <span>{sub.subcategory}</span>
                            </div>
                            <span className={`text-[0.5rem] font-sans font-semibold px-1.5 py-0.2 opacity-80 ${THEME_GLASS.BADGE_MUTED}`}>
                              {sub.presets.length}
                            </span>
                          </RovingLibraryButton>

                          {/* Subcategory Items */}
                          {isSubExpanded && (
                            <div className="flex flex-col gap-2 pl-2 mt-1 animate-[fadeIn_0.15s_ease-out]">
                              {sub.presets.map((preset) => {
                                const mismatches = getPresetMismatchedSettings(preset, settings);
                                const isMismatched = mismatches.length > 0;
                                const mismatchLabels = mismatches.map((m) => m.label).join(', ');

                                return (
                                  <Tooltip
                                    key={preset.id}
                                    interactive={true}
                                    className="max-w-[min(92vw,40rem)]"
                                    content={(
                                      <TooltipCard
                                        eyebrow={`${group.category} · ${sub.subcategory}`}
                                        title={preset.label}
                                        description={preset.description}
                                        equation={parsedPresets[preset.id]}
                                        rawEquation={preset.equation}
                                        wikiUrl={preset.wikiUrl}
                                        footer={isMismatched ? (
                                          <span className={`${THEME_GLASS.SETTING_WARNING_BANNER} text-[0.6875rem] w-full`}>
                                            <TriangleAlert size={12} className={THEME_GLASS.ACTIVE_RESTRICTION_CAVEAT_ICON} />
                                            <span>{mismatchLabels} disabled. Selecting will auto-enable it.</span>
                                          </span>
                                        ) : undefined}
                                      />
                                    )}
                                  >
                                    <RovingLibraryButton
                                      itemKey={`preset-${preset.id}`}
                                      onClick={() => handlePresetSelect(preset.equation, preset.label)}
                                      className={`w-full flex items-center justify-between text-left p-2 pl-2.5 shrink-0 ${THEME_GLASS.CATEGORY_ITEM}`}
                                    >
                                      <div className="flex-1 min-w-0 pr-2">
                                        <div className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors flex items-center gap-2">
                                          <span>{preset.label}</span>
                                          {isMismatched && mismatches.map((m) => (
                                            <span
                                              key={m.key}
                                              role="button"
                                              tabIndex={0}
                                              title={`${m.label} disabled. Click to enable.`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSettings((prev) => ({ ...prev, [m.key]: m.requiredValue }));
                                                setToast({ message: `Enabled ${m.label} setting.`, key: Date.now() });
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                  e.stopPropagation();
                                                  e.preventDefault();
                                                  setSettings((prev) => ({ ...prev, [m.key]: m.requiredValue }));
                                                  setToast({ message: `Enabled ${m.label} setting.`, key: Date.now() });
                                                }
                                              }}
                                              className={THEME_GLASS.SETTING_WARNING_BADGE}
                                            >
                                              Enable {m.label}
                                            </span>
                                          ))}
                                        </div>
                                        <div className="text-xs font-mono text-zinc-500 group-hover:text-indigo-200/80 transition-colors mt-0.5 truncate">
                                          {preset.equation}
                                        </div>
                                      </div>
                                      <div className={THEME_GLASS.ACCENT_PLAY}>
                                        <Play size={10} />
                                      </div>
                                    </RovingLibraryButton>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </RovingTabindexProvider>
    </div>
  );
};


export const Sidebar: React.FC = () => {
  const leftSidebarOpen = useAtomValue(leftSidebarOpenAtom);

  return (
    // <aside> (complementary) landmark so a screen-reader rotor lists the left
    // sidebar as a "jump to" target distinct from the heading outline (#237).
    // Named for both halves it holds (workspace controls + equation library);
    // symmetric with the right-hand "History" aside in ControlPanel.
    <aside
      aria-label="Workspace and library"
      className={`flex flex-col gap-4 fixed top-[var(--header-height)] bottom-0 left-0 z-38 transform transition-all duration-300 ease-in-out overflow-y-auto ${
      leftSidebarOpen
        ? 'w-80 p-4 translate-x-0 opacity-100'
        : 'w-80 p-4 -translate-x-full opacity-100 max-lg:pointer-events-none'
    } lg:relative lg:top-0 lg:translate-x-0 lg:z-30 lg:flex lg:h-full ${
      leftSidebarOpen
        ? 'lg:w-80 lg:min-w-[20rem] lg:p-4 lg:mr-4 lg:opacity-100'
        : 'lg:w-0 lg:min-w-0 lg:p-0 lg:mr-0 lg:opacity-0 lg:border-0 lg:overflow-hidden lg:pointer-events-none'
    } ${THEME_GLASS.PANEL}`}>
      <SidebarContent />
      <LearnPracticeContent showHeader={true} />
      <EquationLibraryContent showHeader={true} />
    </aside>
  );
};
