'use client';

import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Tooltip } from './Tooltip';
import {
  currentEquationAtom,
  pushEquationAtom,
  resetToEquationStringAtom,
  applyGlobalOpAtom,
  savedSessionsAtom,
  currentSessionIdAtom,
  loadSessionAtom,
  deleteSessionAtom,
  presetCategoriesAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { Terminal, ShieldAlert, Plus, Minus, X, Percent, Hash, Play, BookOpen, Sparkles, Trash2, FolderGit2, ChevronDown, ChevronRight } from 'lucide-react';

const formatTimestamp = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const Sidebar: React.FC = () => {
  const currentEq = useAtomValue(currentEquationAtom);
  const pushEquation = useSetAtom(pushEquationAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);
  const applyGlobalOp = useSetAtom(applyGlobalOpAtom);

  const savedSessions = useAtomValue(savedSessionsAtom);
  const currentSessionId = useAtomValue(currentSessionIdAtom);
  const loadSession = useSetAtom(loadSessionAtom);
  const deleteSession = useSetAtom(deleteSessionAtom);
  const presetCategories = useAtomValue(presetCategoriesAtom);

  const [activeTab, setActiveTab] = React.useState<'saved' | 'presets'>('saved');
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({
    'Linear Equations': true, // expand linear category by default
  });

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  const [inputStr, setInputStr] = React.useState('');
  const [errorStr, setErrorStr] = React.useState<string | null>(null);
  const [termInput, setTermInput] = React.useState('');

  const handleLoadCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputStr.trim()) return;

    try {
      setErrorStr(null);
      resetToEquation(inputStr);
      setInputStr('');
      setActiveTab('saved');
    } catch (err) {
      setErrorStr(err instanceof Error ? err.message : String(err));
    }
  };

  const handleApplyGlobalOp = (type: 'square' | 'sqrt' | 'add' | 'sub' | 'mul' | 'div') => {
    try {
      setErrorStr(null);
      applyGlobalOp({ type, term: termInput });
      setTermInput('');
    } catch (err) {
      setErrorStr(`Failed to apply operation: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePresetSelect = (eqStr: string) => {
    try {
      setErrorStr(null);
      resetToEquation(eqStr);
      setActiveTab('saved');
    } catch (err) {
      setErrorStr(`Error loading preset: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className={`w-80 h-full flex flex-col gap-6 p-5 ${THEME_GLASS.PANEL}`}>
      {/* Sidebar Header */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 shrink-0">
        <BookOpen className="text-indigo-400" size={18} />
        <h2 className="text-lg font-bold text-white select-none">
          <span>Operations & Presets</span>
        </h2>
      </div>

      {/* 1. Custom Equation Loader */}
      <div className={`p-4 shrink-0 ${THEME_GLASS.CARD}`}>
        <h3 className="text-xs font-bold text-white mb-2.5 flex items-center gap-2 select-none">
          <Terminal className="text-indigo-400" size={14} />
          <span>Load Equation Workspace</span>
        </h3>
        <form onSubmit={handleLoadCustom} className="flex gap-2">
          <input
            type="text"
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            placeholder="Type equation, e.g. 2x + 4 = 10"
            className="flex-1 px-3 py-1.5 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-mono"
          />
          <button
            type="submit"
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 ${THEME_TRANSITIONS.FAST}`}
          >
            Load
          </button>
        </form>

        {errorStr && (
          <div className="mt-2.5 flex items-start gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2">
            <ShieldAlert size={12} className="shrink-0 mt-0.5" />
            <span className="break-all">{errorStr}</span>
          </div>
        )}
      </div>

      {/* 2. Global Operations Panel */}
      <div className={`p-4 shrink-0 ${THEME_GLASS.CARD} flex flex-col gap-3`}>
        <h3 className="text-xs font-bold text-white flex items-center gap-2 select-none">
          <Sparkles className="text-indigo-400" size={14} />
          <span>Global Operations (Both Sides)</span>
        </h3>

        {/* Action button Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleApplyGlobalOp('square')}
            className={`py-1.5 px-3.5 text-[11px] font-semibold rounded-xl border border-white/10 text-indigo-200 hover:text-white hover:bg-white/5 active:scale-98 ${THEME_TRANSITIONS.FAST}`}
          >
            Square ( )²
          </button>
          <button
            onClick={() => handleApplyGlobalOp('sqrt')}
            className={`py-1.5 px-3.5 text-[11px] font-semibold rounded-xl border border-white/10 text-indigo-200 hover:text-white hover:bg-white/5 active:scale-98 ${THEME_TRANSITIONS.FAST}`}
          >
            Square Root √
          </button>
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

      {/* 3. Library & Sessions Tabs */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 border-t border-white/10 pt-4">
        {/* Tab Header Selector */}
        <div className="flex bg-neutral-950/40 p-1 border border-white/5 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <FolderGit2 size={12} />
            <span>Saved Workspaces</span>
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Hash size={12} />
            <span>Presets Library</span>
          </button>
        </div>

        {/* Tab Content List Container */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
          {activeTab === 'presets' ? (
            presetCategories.map((group) => {
              const isExpanded = !!expandedCategories[group.category];
              return (
                <div key={group.category} className="flex flex-col gap-1.5 mb-2.5 shrink-0">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className="w-full flex items-center justify-between py-1.5 px-2 bg-neutral-900/40 hover:bg-neutral-900/60 border border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-indigo-300 hover:text-indigo-200 transition-all select-none cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      <span>{group.category}</span>
                    </div>
                    <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
                      {group.presets.length}
                    </span>
                  </button>

                  {/* Category Items (Collapsible) */}
                  {isExpanded && (
                    <div className="flex flex-col gap-1.5 pl-1.5 border-l border-white/5 ml-1.5 mt-1 animate-[fadeIn_0.2s_ease-out]">
                      {group.presets.map((preset) => (
                        <Tooltip
                          key={preset.id}
                          content={preset.description}
                        >
                          <button
                            onClick={() => handlePresetSelect(preset.equation)}
                            className="w-full flex items-center justify-between text-left p-2.5 rounded-xl border border-white/5 bg-white/0 hover:bg-white/5 hover:border-white/10 group transition-all duration-200 cursor-pointer shrink-0"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="text-xs text-indigo-300 font-semibold group-hover:text-indigo-200 transition-colors">
                                {preset.label}
                              </div>
                              <div className="text-xs font-mono text-white/70 group-hover:text-white transition-colors truncate">
                                {preset.equation}
                              </div>
                            </div>
                            <Play
                              size={11}
                              className="text-white/20 group-hover:text-indigo-400 group-hover:translate-x-0.5 transform transition-all duration-200 shrink-0"
                            />
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            savedSessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/5 rounded-xl text-white/30 text-xs gap-1.5 select-none my-auto">
                <FolderGit2 size={24} className="text-white/20" />
                <span>No saved workspaces yet</span>
                <span className="text-[10px] text-white/20">Derivations are auto-saved here</span>
              </div>
            ) : (
              savedSessions.map((session) => {
                const isActive = session.id === currentSessionId;
                const nodeCount = Object.keys(session.tree).length;
                return (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border group transition-all duration-200 shrink-0 ${
                      isActive
                        ? 'border-indigo-500/40 bg-indigo-600/10'
                        : 'border-white/5 bg-white/0 hover:bg-white/5 hover:border-white/10'
                    }`}
                  >
                    <button
                      onClick={() => loadSession(session.id)}
                      className="flex-1 text-left min-w-0 pr-2 cursor-pointer"
                    >
                      <div className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-200' : 'text-indigo-300 group-hover:text-indigo-200'}`}>
                        {session.name}
                      </div>
                      <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5 select-none">
                        <span>{nodeCount} {nodeCount === 1 ? 'step' : 'steps'}</span>
                        <span>•</span>
                        <span>{formatTimestamp(session.timestamp)}</span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse mr-1" title="Active session" />
                      )}
                      <Tooltip content="Delete workspace">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
};
