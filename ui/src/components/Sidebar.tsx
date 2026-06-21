// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { useIsHydrated } from '../hooks/useIsHydrated';
import { Tooltip } from './Tooltip';
import { TooltipCard } from './TooltipCard';
import { Equation, parseEquation, ensureNodeIds, deserializeEquation } from 'math-engine-client';
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
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import { ShieldAlert, X, Percent, Play, FolderGit2, ChevronDown, ChevronRight, Hash, Zap, Triangle, Activity, BookOpen, Library, LayoutGrid, PenTool, Search } from 'lucide-react';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Linear & Basic Algebra':
      return <Hash size={11} className="text-blue-400 shrink-0" />;
    case 'Quadratics & Polynomials':
      return <Zap size={11} className="text-amber-400 shrink-0" />;
    case 'Fractions, Radicals & Rationals':
      return <Percent size={11} className="text-teal-400 shrink-0" />;
    case 'Transcendental (Logs & Trig)':
      return <Activity size={11} className="text-pink-400 shrink-0" />;
    case 'Formulas (Physics, Geometry & Science)':
      return <Triangle size={11} className="text-emerald-400 shrink-0" />;
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
  const setOnboardingShowDirectory = useSetAtom(onboardingShowDirectoryAtom);
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
      if (node) eq = deserializeEquation(node.equation);
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
        <Tooltip content="Toggle Workspace (W)" position="right" autoAlign={false}>
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
          <span className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} uppercase tracking-wider font-semibold select-none`}>
            Define Equation
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Tooltip content="Enter your own equation in a new workspace (N)" position="bottom" autoAlign={false} wrapperClassName="w-full">
              <button
                type="button"
                onClick={() => {
                  setIsInputModalOpen(true);
                  onCloseMobile?.();
                }}
                className={`w-full h-9 px-3 text-[11px] font-bold flex items-center justify-center gap-1.5 ${THEME_GLASS.BUTTON_PRIMARY}`}
              >
                <PenTool size={12} />
                <span>New</span>
              </button>
            </Tooltip>
            <Tooltip content="Learn the app with an interactive, guided tutorial" position="bottom" autoAlign={false} wrapperClassName="w-full">
              <button
                type="button"
                onClick={() => {
                  setOnboardingShowDirectory(true);
                  onCloseMobile?.();
                }}
                className={`w-full h-9 px-3 text-[11px] font-bold flex items-center justify-center gap-1.5 ${THEME_GLASS.BUTTON_SECONDARY}`}
              >
                <BookOpen size={12} className="text-indigo-400" />
                <span>Tutorial</span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Recents Dropdown Selector Section */}
        <div className={`flex flex-col gap-1.5 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-3 shrink-0`}>
          <span className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} uppercase tracking-wider font-semibold select-none`}>
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
                                <span className={`text-[10px] ${THEME_GLASS.TEXT_MUTED_EXTRA} whitespace-nowrap font-sans shrink-0 flex items-center gap-1.5`}>
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
              <p className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} mt-1 uppercase tracking-wider font-semibold`}>Explore and select a recent workspace</p>
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
                      <div className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} mt-1 flex items-center gap-1.5 font-sans`}>
                        <span>{stepCount} {stepCount === 1 ? 'step' : 'steps'}</span>
                        <span>·</span>
                        <span>{formatTimestamp(session.timestamp)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {isActive ? (
                        <span className={`text-[9px] font-sans font-bold uppercase tracking-wider px-2.5 py-0.5 ${THEME_GLASS.ACTIVE_BADGE}`}>
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

interface EquationLibraryContentProps {
  onCloseMobile?: () => void;
  showHeader?: boolean;
}

export const EquationLibraryContent: React.FC<EquationLibraryContentProps> = ({
  onCloseMobile,
  showHeader = false,
}) => {
  const [, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);
  const presetCategories = useAtomValue(presetCategoriesAtom);
  const [searchQuery, setSearchQuery] = useAtom(presetSearchQueryAtom);
  const isSearching = searchQuery.trim().length > 0;
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});
  const [errorStr, setErrorStr] = React.useState<string | null>(null);

  // Pre-parse each preset's equation once so the hover tooltip can render it in
  // pretty (typeset) form without re-parsing on every render. Unparseable
  // presets fall back to their raw string in the tooltip.
  const parsedPresets = React.useMemo(() => {
    const map: Record<string, Equation | null> = {};
    for (const group of presetCategories) {
      for (const preset of group.presets) {
        try {
          map[preset.id] = ensureNodeIds(parseEquation(preset.equation));
        } catch {
          map[preset.id] = null;
        }
      }
    }
    return map;
  }, [presetCategories]);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const wasExpanded = !!prev[categoryName];
      if (wasExpanded) {
        return {};
      } else {
        return { [categoryName]: true };
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
          <Tooltip content="Toggle Equation Library (L)" position="right" autoAlign={false}>
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
        <div className={`flex items-start gap-2 text-[10px] p-2 animate-[fadeIn_0.2s_ease-out] shrink-0 ${THEME_GLASS.BUTTON_DANGER}`}>
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
      <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 ${THEME_GLASS.TREE_BG}`}>
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
          return (
            <div key={group.category} className="flex flex-col gap-1.5 mb-1.5 shrink-0">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(group.category)}
                className={`w-full flex items-center justify-between py-2 px-3 text-[10px] font-bold uppercase tracking-wider ${THEME_GLASS.CATEGORY_HEADER}`}
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
                <span className={`text-[9px] font-sans font-semibold px-2 py-0.5 group-hover:text-white ${THEME_GLASS.BADGE_MUTED}`}>
                  {group.presets.length}
                </span>
              </button>

              {/* Category Items (Collapsible) */}
              {isExpanded && (
                <div className={`flex flex-col gap-2 pl-2 border-l ${THEME_GLASS.PANEL_BORDER_SUBTLE} ml-3 mt-1.5 animate-[fadeIn_0.2s_ease-out]`}>
                  {group.presets.map((preset) => (
                    <Tooltip
                      key={preset.id}
                      className="max-w-[min(92vw,40rem)]"
                      content={(
                        <TooltipCard
                          eyebrow={group.category}
                          title={preset.label}
                          description={preset.description}
                          equation={parsedPresets[preset.id]}
                          rawEquation={preset.equation}
                        />
                      )}
                    >
                      <button
                        onClick={() => handlePresetSelect(preset.equation, preset.label)}
                        className={`w-full flex items-center justify-between text-left p-2.5 pl-3 shrink-0 ${THEME_GLASS.CATEGORY_ITEM}`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">
                            {preset.label}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 group-hover:text-indigo-200/80 transition-colors mt-0.5 truncate">
                            {preset.equation}
                          </div>
                        </div>
                        <div className={THEME_GLASS.ACCENT_PLAY}>
                          <Play size={10} />
                        </div>
                      </button>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const leftSidebarOpen = useAtomValue(leftSidebarOpenAtom);

  return (
    <div className={`flex flex-col gap-4 fixed top-16 bottom-0 left-0 z-38 transform transition-all duration-300 ease-in-out ${
      leftSidebarOpen
        ? 'w-80 p-4 translate-x-0 opacity-100'
        : 'w-80 p-4 -translate-x-full opacity-100 max-lg:pointer-events-none'
    } lg:relative lg:top-0 lg:translate-x-0 lg:z-30 lg:flex lg:h-full ${
      leftSidebarOpen
        ? 'lg:w-80 lg:min-w-[20rem] lg:p-4 lg:mr-4 lg:opacity-100'
        : 'lg:w-0 lg:min-w-0 lg:p-0 lg:mr-0 lg:opacity-0 lg:border-0 lg:overflow-hidden lg:pointer-events-none'
    } ${THEME_GLASS.PANEL}`}>
      <SidebarContent />
      <EquationLibraryContent showHeader={true} />
    </div>
  );
};
