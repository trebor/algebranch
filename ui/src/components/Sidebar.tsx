'use client';

import React from 'react';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { Tooltip } from './Tooltip';
import {
  currentEquationAtom,
  pushEquationAtom,
  resetToEquationStringAtom,
  applyGlobalOpAtom,
  savedSessionsAtom,
  currentSessionIdAtom,
  loadSessionAtom,
  presetCategoriesAtom,
  leftSidebarOpenAtom,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import { Terminal, ShieldAlert, Plus, Minus, X, Percent, Play, Sparkles, Trash2, FolderGit2, ChevronDown, ChevronRight, Hash, Zap, Layers, Triangle, Activity, Flame, BookOpen } from 'lucide-react';

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
  showGlobalOps?: boolean;
  onCloseMobile?: () => void;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
  showGlobalOps = true,
  onCloseMobile,
}) => {
  const [leftSidebarOpen, setLeftSidebarOpen] = useAtom(leftSidebarOpenAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);
  const applyGlobalOp = useSetAtom(applyGlobalOpAtom);

  const savedSessions = useAtomValue(savedSessionsAtom);
  const currentSessionId = useAtomValue(currentSessionIdAtom);
  const currentSession = savedSessions.find(s => s.id === currentSessionId);
  const loadSession = useSetAtom(loadSessionAtom);
  const presetCategories = useAtomValue(presetCategoriesAtom);
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

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

  const [inputStr, setInputStr] = React.useState('');
  const [errorStr, setErrorStr] = React.useState<string | null>(null);
  const [termInput, setTermInput] = React.useState('');
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isSquareDropdownOpen, setIsSquareDropdownOpen] = React.useState(false);
  const [isSqrtDropdownOpen, setIsSqrtDropdownOpen] = React.useState(false);

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

  const handleApplyGlobalOp = (type: 'square' | 'sqrt' | 'add' | 'sub' | 'mul' | 'div' | 'power' | 'root', power?: number) => {
    try {
      setErrorStr(null);
      applyGlobalOp({ type, term: termInput, power });
      trackEvent({
        action: 'apply_global_op',
        category: 'operations',
        label: type,
      });
      setTermInput('');
    } catch (err) {
      setErrorStr(`Failed to apply operation: ${err instanceof Error ? err.message : String(err)}`);
    }
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
      setErrorStr(`Error loading preset: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const triggerTooltipContent = currentSession ? (
    <div className="flex flex-col gap-1 text-left max-w-xs select-none">
      <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Full Expression</span>
      <span className="font-mono text-xs text-indigo-300 break-all">{currentSession.name}</span>
      <div className="border-t border-white/5 my-0.5" />
      <div className="text-[10px] text-white/40 flex items-center gap-1.5">
        <span>Last used:</span>
        <span className="text-indigo-300 font-medium">{formatTimestamp(currentSession.timestamp)}</span>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* 1. Workspace Card */}
      <div className={`p-4 shrink-0 flex flex-col gap-3 relative z-20 ${THEME_GLASS.CARD}`}>
        <h3 className="text-xs font-bold text-white flex items-center gap-2 select-none">
          <Terminal className="text-indigo-400" size={14} />
          <span>Workspace</span>
        </h3>

        {/* Define Section */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none">
            Define
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
          <div className="flex items-start gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2 animate-[fadeIn_0.2s_ease-out]">
            <ShieldAlert size={12} className="shrink-0 mt-0.5" />
            <span className="break-all">{errorStr}</span>
          </div>
        )}

        {/* Recents Section */}
        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none">
            Recents
          </span>
          <div className="relative w-full">
            {savedSessions.length > 0 ? (
              <>
                {!isDropdownOpen && currentSession ? (
                  <Tooltip 
                    content={triggerTooltipContent} 
                    wrapperClassName="w-full min-w-0"
                  >
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full h-8 px-3 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500/80 hover:border-white/20 transition-all font-mono cursor-pointer flex items-center justify-between gap-2 min-w-0"
                    >
                      <span className="truncate flex-1 text-left">
                        {currentSession.name}
                      </span>
                      <ChevronDown size={12} className={`text-white/40 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full h-8 px-3 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500/80 hover:border-white/20 transition-all font-mono cursor-pointer flex items-center justify-between gap-2 min-w-0"
                  >
                    <span className="truncate flex-1 text-left">
                      {currentSession?.name || 'Select equation...'}
                    </span>
                    <ChevronDown size={12} className={`text-white/40 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setIsDropdownOpen(false)} 
                    />
                    <div className="absolute left-0 right-0 mt-1.5 bg-neutral-950/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-y-auto max-h-60 z-50 py-1 animate-[fadeIn_0.15s_ease-out]">
                      {[...savedSessions]
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map((session) => {
                          const isActive = session.id === currentSessionId;
                          const stepCount = getStepCount(session.tree);
                          return (
                            <button
                              key={session.id}
                              type="button"
                              onClick={() => {
                                loadSession(session.id);
                                trackEvent({
                                  action: 'load_session',
                                  category: 'sessions',
                                  label: session.id,
                                });
                                setIsDropdownOpen(false);
                                if (window.innerWidth < 1024) {
                                  setLeftSidebarOpen(false);
                                }
                                onCloseMobile?.();
                              }}
                              className={`w-full text-left px-3 py-2 text-xs flex justify-between items-center gap-4 hover:bg-indigo-600/20 transition-colors cursor-pointer ${
                                isActive ? 'text-indigo-300 bg-indigo-600/5 font-semibold' : 'text-white/70'
                              }`}
                            >
                              <span className="truncate font-mono flex-1">
                                {session.name}
                              </span>
                              <span className="text-[10px] text-white/30 whitespace-nowrap font-sans shrink-0 flex items-center gap-1.5">
                                <span>{stepCount} {stepCount === 1 ? 'step' : 'steps'}</span>
                                <span>·</span>
                                <span>{formatTimestamp(session.timestamp)}</span>
                              </span>
                            </button>
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
                className="w-full h-8 px-3 text-xs bg-neutral-950 border border-white/5 rounded-xl text-white/30 transition-all font-mono flex items-center justify-between gap-2 min-w-0 cursor-not-allowed"
              >
                <span className="truncate flex-1 text-left">
                  No recent workspaces
                </span>
                <ChevronDown size={12} className="text-white/20 shrink-0" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Global Operations Panel */}
      {showGlobalOps && (
        <div className={`p-4 shrink-0 ${THEME_GLASS.CARD} flex flex-col gap-3`}>
          <h3 className="text-xs font-bold text-white flex items-center gap-2 select-none">
            <Sparkles className="text-indigo-400" size={14} />
            <span>Global Operations</span>
          </h3>

          {/* Action button Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Square Button with Dropdown */}
            <div className="relative flex rounded-xl border border-white/10 bg-white/5 overflow-visible">
              <button
                onClick={() => handleApplyGlobalOp('square')}
                className="flex-1 py-1.5 pl-3 pr-1 text-[11px] font-semibold text-indigo-200 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left rounded-l-xl active:bg-white/10"
              >
                Square ( )²
              </button>
              <button
                onClick={() => {
                  setIsSquareDropdownOpen(!isSquareDropdownOpen);
                  setIsSqrtDropdownOpen(false);
                }}
                className="px-2 flex items-center justify-center border-l border-white/10 text-indigo-300 hover:text-white hover:bg-white/5 transition-colors rounded-r-xl cursor-pointer active:bg-white/10"
                title="Select other powers"
              >
                <ChevronDown
                  size={12}
                  className={`text-white/40 transition-transform duration-200 shrink-0 ${isSquareDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isSquareDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setIsSquareDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-neutral-950/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl z-50 py-1 animate-[fadeIn_0.15s_ease-out]">
                    <button
                      onClick={() => {
                        handleApplyGlobalOp('power', 3);
                        setIsSquareDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[10px] text-indigo-200 hover:bg-indigo-600/20 hover:text-white transition-colors cursor-pointer font-medium"
                    >
                      Cube ( )³
                    </button>
                    <button
                      onClick={() => {
                        handleApplyGlobalOp('power', 4);
                        setIsSquareDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[10px] text-indigo-200 hover:bg-indigo-600/20 hover:text-white transition-colors cursor-pointer font-medium"
                    >
                      4th Power ( )⁴
                    </button>
                    <button
                      onClick={() => {
                        handleApplyGlobalOp('power', 5);
                        setIsSquareDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[10px] text-indigo-200 hover:bg-indigo-600/20 hover:text-white transition-colors cursor-pointer font-medium"
                    >
                      5th Power ( )⁵
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Square Root Button with Dropdown */}
            <div className="relative flex rounded-xl border border-white/10 bg-white/5 overflow-visible">
              <button
                onClick={() => handleApplyGlobalOp('sqrt')}
                className="flex-1 py-1.5 pl-3 pr-1 text-[11px] font-semibold text-indigo-200 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left rounded-l-xl active:bg-white/10"
              >
                Square Root √
              </button>
              <button
                onClick={() => {
                  setIsSqrtDropdownOpen(!isSqrtDropdownOpen);
                  setIsSquareDropdownOpen(false);
                }}
                className="px-2 flex items-center justify-center border-l border-white/10 text-indigo-300 hover:text-white hover:bg-white/5 transition-colors rounded-r-xl cursor-pointer active:bg-white/10"
                title="Select other roots"
              >
                <ChevronDown
                  size={12}
                  className={`text-white/40 transition-transform duration-200 shrink-0 ${isSqrtDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isSqrtDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setIsSqrtDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-neutral-950/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl z-50 py-1 animate-[fadeIn_0.15s_ease-out]">
                    <button
                      onClick={() => {
                        handleApplyGlobalOp('root', 3);
                        setIsSqrtDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[10px] text-indigo-200 hover:bg-indigo-600/20 hover:text-white transition-colors cursor-pointer font-medium"
                    >
                      Cube Root ∛
                    </button>
                    <button
                      onClick={() => {
                        handleApplyGlobalOp('root', 4);
                        setIsSqrtDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[10px] text-indigo-200 hover:bg-indigo-600/20 hover:text-white transition-colors cursor-pointer font-medium"
                    >
                      4th Root ∜
                    </button>
                    <button
                      onClick={() => {
                        handleApplyGlobalOp('root', 5);
                        setIsSqrtDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[10px] text-indigo-200 hover:bg-indigo-600/20 hover:text-white transition-colors cursor-pointer font-medium"
                    >
                      5th Root ⁵√
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-white/5 pt-3 flex flex-col gap-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                placeholder="Specify term, e.g. 5x"
                className="flex-1 px-3 py-1.5 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-mono"
              />
            </div>

            {/* Inline operations grid */}
            <div className="grid grid-cols-4 gap-1.5">
              <Tooltip content="Add term">
                <button
                  onClick={() => handleApplyGlobalOp('add')}
                  className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer"
                >
                  <Plus size={12} />
                </button>
              </Tooltip>
              <Tooltip content="Subtract term">
                <button
                  onClick={() => handleApplyGlobalOp('sub')}
                  className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer"
                >
                  <Minus size={12} />
                </button>
              </Tooltip>
              <Tooltip content="Multiply by term">
                <button
                  onClick={() => handleApplyGlobalOp('mul')}
                  className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </Tooltip>
              <Tooltip content="Divide by term">
                <button
                  onClick={() => handleApplyGlobalOp('div')}
                  className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer"
                >
                  <Percent size={12} className="rotate-45" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* 3. Presets Library */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 border-t border-white/10 pt-4">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 select-none px-1">
          <FolderGit2 className="text-indigo-400" size={14} />
          <span>Presets Library</span>
        </h3>

        {/* Tab Content List Container */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
          {presetCategories.map((group) => {
            const isExpanded = !!expandedCategories[group.category];
            return (
              <div key={group.category} className="flex flex-col gap-1.5 mb-2.5 shrink-0">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(group.category)}
                  className="w-full flex items-center justify-between py-1.5 px-2 bg-neutral-950 border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-indigo-300 hover:text-indigo-200 transition-all select-none cursor-pointer hover:border-white/10 hover:bg-neutral-900/20"
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
                          className="w-full flex items-center justify-between text-left p-2.5 pl-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-indigo-500/5 hover:border-indigo-500/10 border-l-2 border-l-transparent hover:border-l-indigo-400/80 group transition-all duration-200 cursor-pointer shrink-0 shadow-sm shadow-black/20"
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
    </>
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
      <SidebarContent showGlobalOps={true} />
    </div>
  );
};
