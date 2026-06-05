'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { Tooltip } from './Tooltip';
import {
  currentEquationAtom,
  pushEquationAtom,
  resetToEquationStringAtom,
  savedSessionsAtom,
  currentSessionIdAtom,
  loadSessionAtom,
  presetCategoriesAtom,
  leftSidebarOpenAtom,
  deleteConfirmationModalOpenAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import { Terminal, ShieldAlert, Plus, Minus, X, Percent, Play, Sparkles, Trash2, FolderGit2, ChevronDown, ChevronRight, Hash, Zap, Layers, Triangle, Activity, Flame, BookOpen, Library, LayoutGrid } from 'lucide-react';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Linear Equations':
      return <Hash size={11} className="text-blue-400 shrink-0" />;
    case 'Fractions & Ratios':
      return <Percent size={11} className="text-teal-400 shrink-0" />;
    case 'Quadratics & Roots':
      return <Zap size={11} className="text-amber-400 shrink-0" />;
    case 'Literal Equations':
      return <Layers size={11} className="text-purple-400 shrink-0" />;
    case 'Geometry':
      return <Triangle size={11} className="text-emerald-400 shrink-0" />;
    case 'Classical Physics':
      return <Activity size={11} className="text-rose-400 shrink-0" />;
    case 'Thermodynamics & Chemistry':
      return <Flame size={11} className="text-orange-400 shrink-0" />;
    case 'Algebraic Identities':
      return <BookOpen size={11} className="text-pink-400 shrink-0" />;
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

const getStepCount = (tree: Record<string, any> | undefined | null): number => {
  if (!tree) return 0;
  return Math.max(0, Object.keys(tree).length - 1);
};

interface SidebarContentProps {
  onCloseMobile?: () => void;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
  onCloseMobile,
}) => {
  const [leftSidebarOpen, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);

  const savedSessions = useAtomValue(savedSessionsAtom);
  const currentSessionId = useAtomValue(currentSessionIdAtom);
  const currentSession = savedSessions.find(s => s.id === currentSessionId);
  const loadSession = useSetAtom(loadSessionAtom);
  const setDeleteModalOpen = useSetAtom(deleteConfirmationModalOpenAtom);

  const [inputStr, setInputStr] = React.useState('');
  const [errorStr, setErrorStr] = React.useState<string | null>(null);

  const handleLoadCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputStr.trim()) return;

    try {
      setErrorStr(null);
      resetToEquation(inputStr);
      trackEvent({
        action: 'load_custom_equation',
        category: 'presets',
        label: inputStr,
      });
      setInputStr('');
      if (window.innerWidth < 1024) {
        setLeftSidebarOpen(false);
      }
      onCloseMobile?.();
    } catch (err) {
      setErrorStr(err instanceof Error ? err.message : String(err));
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Header with Actions */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        {!isMobile && (
          <h2 className="text-lg font-bold text-white flex items-center gap-2 select-none">
            <LayoutGrid className="text-indigo-400" size={18} />
            <span>Workspace</span>
          </h2>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <Tooltip content="Delete workspace permanently">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModalOpen(true);
              }}
              disabled={savedSessions.length <= 1}
              className={`p-1.5 rounded-lg border border-white/10 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 ${THEME_TRANSITIONS.FAST} cursor-pointer`}
            >
              <Trash2 size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Recessed Content Box */}
      <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-4 ${THEME_GLASS.TREE_BG}`}>
        {/* Define Section */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none">
            Define Equation
          </span>
          <form onSubmit={handleLoadCustom} className="flex gap-2">
            <input
              type="text"
              value={inputStr}
              onChange={(e) => setInputStr(e.target.value)}
              placeholder="New equation, e.g. 2x + 4 = 10"
              className="flex-1 h-8 px-3 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-mono"
            />
            <Tooltip content="Enter equation">
              <button
                type="submit"
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all duration-150 cursor-pointer"
              >
                <Plus size={13} />
              </button>
            </Tooltip>
          </form>
        </div>

        {errorStr && (
          <div className="flex items-start gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2 animate-[fadeIn_0.2s_ease-out] shrink-0">
            <ShieldAlert size={12} className="shrink-0 mt-0.5" />
            <span className="break-all">{errorStr}</span>
          </div>
        )}

        {/* Recents/Saved Workspaces Section */}
        <div className="flex-1 flex flex-col gap-2 min-h-0 border-t border-white/5 pt-3">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none mb-1 shrink-0">
            Saved Workspaces
          </span>
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            {savedSessions.length > 0 ? (
              [...savedSessions]
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
                        if (window.innerWidth < 1024) {
                          setLeftSidebarOpen(false);
                        }
                        onCloseMobile?.();
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center gap-3 cursor-pointer hover:scale-[1.01] active:scale-98 duration-150 ${
                        isActive
                          ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-semibold shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                          : 'border-white/5 bg-neutral-950/80 hover:bg-neutral-900/90 text-white/55 hover:text-white/85 shadow-sm'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-mono text-xs truncate text-indigo-50 font-semibold">
                          {session.name}
                        </div>
                        <div className="text-[9px] text-white/40 mt-0.5 flex items-center gap-1.5 font-sans">
                          <span>{stepCount} {stepCount === 1 ? 'step' : 'steps'}</span>
                          <span>·</span>
                          <span>{formatTimestamp(session.timestamp)}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isActive ? (
                          <span className="text-[8px] font-sans font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
                            Active
                          </span>
                        ) : (
                          <ChevronRight size={12} className="text-white/30" />
                        )}
                      </div>
                    </button>
                  );
                })
            ) : (
              <div className="text-xs text-white/30 italic text-center py-4 select-none">
                No saved workspaces yet.
              </div>
            )}
          </div>
        </div>
      </div>
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
  const [leftSidebarOpen, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);
  const presetCategories = useAtomValue(presetCategoriesAtom);
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});
  const [errorStr, setErrorStr] = React.useState<string | null>(null);

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

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Header */}
      {showHeader && !isMobile && (
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 select-none">
            <Library className="text-indigo-400" size={18} />
            <span>Equation Library</span>
          </h2>
        </div>
      )}

      {errorStr && (
        <div className="flex items-start gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2 animate-[fadeIn_0.2s_ease-out] shrink-0">
          <ShieldAlert size={12} className="shrink-0 mt-0.5" />
          <span className="break-all">{errorStr}</span>
        </div>
      )}

      {/* Recessed Content Box */}
      <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 ${THEME_GLASS.TREE_BG}`}>
        {presetCategories.map((group) => {
          const isExpanded = !!expandedCategories[group.category];
          return (
            <div key={group.category} className="flex flex-col gap-1.5 mb-1.5 shrink-0">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(group.category)}
                className="w-full flex items-center justify-between py-2 px-3 bg-neutral-950/60 border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-indigo-300 hover:text-indigo-200 transition-all select-none cursor-pointer hover:border-white/10 hover:bg-neutral-900/20"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white/40">
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getCategoryIcon(group.category)}
                    <span>{group.category}</span>
                  </div>
                </div>
                <span className="text-[9px] font-sans font-semibold text-white/40 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 group-hover:text-white">
                  {group.presets.length}
                </span>
              </button>

              {/* Category Items (Collapsible) */}
              {isExpanded && (
                <div className="flex flex-col gap-2 pl-2 border-l border-white/5 ml-3 mt-1.5 animate-[fadeIn_0.2s_ease-out]">
                  {group.presets.map((preset) => (
                    <Tooltip
                      key={preset.id}
                      content={preset.description}
                    >
                      <button
                        onClick={() => handlePresetSelect(preset.equation, preset.label)}
                        className="w-full flex items-center justify-between text-left p-2.5 pl-3 rounded-xl border border-white/5 bg-neutral-950/80 hover:bg-neutral-900/90 text-white/55 hover:text-white/85 transition-all duration-200 cursor-pointer shrink-0 shadow-sm"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">
                            {preset.label}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 group-hover:text-indigo-200/80 transition-colors mt-0.5 truncate">
                            {preset.equation}
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-white/0 group-hover:bg-indigo-600/20 text-white/20 group-hover:text-indigo-400 border border-transparent group-hover:border-indigo-500/30 transform group-hover:scale-105 transition-all duration-200 shrink-0">
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
