// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React, { useState, useRef, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Plus, X, Layers, Pencil } from 'lucide-react';
import {
  tabsAtom,
  activeTabIdAtom,
  closeTabAtom,
  renameTabAtom,
  equationInputModalOpenAtom,
  WorkspaceTab
} from '../store/equation';
import { Tooltip } from './Tooltip';
import { HotkeyHint } from './HotkeyHint';
import { TooltipCard } from './TooltipCard';
import { THEME_GLASS } from '../constants/theme';

const formatTimestamp = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const WorkspaceTabs: React.FC = () => {
  const [tabs] = useAtom(tabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);
  const [, closeTab] = useAtom(closeTabAtom);
  const [, renameTab] = useAtom(renameTabAtom);
  const setIsInputModalOpen = useSetAtom(equationInputModalOpenAtom);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // Scroll active tab into view horizontally when activeTabId changes
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [activeTabId]);

  const handleStartEdit = (e: React.MouseEvent, tab: WorkspaceTab) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditName(tab.name);
  };

  const handleSaveRename = (tabId: string) => {
    if (editName.trim()) {
      renameTab({ tabId, name: editName.trim() });
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(tabId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  // Keyboard activation for the tab itself (select the workspace). Ignored when
  // the key originated on a nested control (rename input, pencil/close buttons),
  // which carry their own handlers.
  const handleTabKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      setActiveTabId(tabId);
    }
  };

  const truncateName = (name: string, maxLen = 18) => {
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen) + '...';
  };

  return (
    <nav aria-label="Workspaces" className="w-full flex items-center justify-between bg-transparent px-0 max-lg:px-3 pt-2 pb-0 gap-4 shrink-0 select-none">
      {/* Scrollable tab containers list */}
      <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;
          const stepCount = tab.historyTree ? Math.max(0, Object.keys(tab.historyTree).length - 1) : 0;
          const lastEditTime = tab.timestamp || (() => {
            if (!tab.historyTree) return Date.now();
            const vals = Object.values(tab.historyTree).map(n => n.timestamp || 0);
            return vals.length > 0 ? Math.max(...vals) : Date.now();
          })();

          const tabEq = tab.historyTree?.[tab.currentNodeId]?.equation
            ?? tab.historyTree?.['0']?.equation
            ?? null;
          const tooltipContent = (
            <TooltipCard
              eyebrow={tab.chapterId ? 'Tutorial Workspace' : 'Workspace'}
              meta={`${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`}
              title={tab.name}
              equation={tabEq}
              footer={<span>{formatTimestamp(lastEditTime)}</span>}
            />
          );

          return (
            <div
              key={tab.id}
              ref={isActive ? activeTabRef : undefined}
              onClick={() => !isEditing && setActiveTabId(tab.id)}
              onDoubleClick={(e) => handleStartEdit(e, tab)}
              {...(isEditing
                ? {}
                : {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `Workspace: ${tab.name}`,
                    // Workspaces are mutually exclusive, so the active tab is the
                    // "current" selection — not an independent on/off toggle
                    // (which aria-pressed would make a screen reader announce).
                    'aria-current': isActive || undefined,
                    onKeyDown: (e: React.KeyboardEvent) => handleTabKeyDown(e, tab.id),
                  })}
              className={`group flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer select-none transition-all duration-200 shrink-0 ${THEME_GLASS.NODE_FOCUS_RING} ${
                isActive
                  ? 'bg-white/10 border-indigo-500/30 text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)] backdrop-blur-sm'
                  : 'bg-white/5 border-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 hover:border-white/10 backdrop-blur-sm'
              }`}
            >
              <Layers size={11} className={isActive ? 'text-indigo-400' : 'text-white/30 group-hover:text-white/50'} />
              
              {isEditing ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleSaveRename(tab.id)}
                  onKeyDown={(e) => handleKeyDown(e, tab.id)}
                  className="bg-neutral-900 border border-indigo-500/50 rounded px-1 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[120px]"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <Tooltip content={tooltipContent} position="bottom" autoAlign={false} className="max-w-[min(92vw,40rem)]">
                  <span className="truncate max-w-[120px] tracking-wide">
                    {truncateName(tab.name)}
                  </span>
                </Tooltip>
              )}

              {/* Action buttons inside tab */}
              {!isEditing && (
                <div className="flex items-center gap-1">
                  {/* Small pencil icon visible on hover for active tab */}
                  {isActive && (
                    <Tooltip content="Rename workspace" position="bottom" autoAlign={false}>
                      <button
                        onClick={(e) => handleStartEdit(e, tab)}
                        className="hover:text-white p-0.5 rounded cursor-pointer transition-all duration-150 text-white/40"
                        aria-label="Rename workspace"
                      >
                        <Pencil size={9} />
                      </button>
                    </Tooltip>
                  )}
                  {/* Close tab button */}
                  <Tooltip content="Close workspace tab (⌘⌫)" position="bottom" autoAlign={false}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className={`p-0.5 rounded hover:bg-white/10 hover:text-white cursor-pointer transition-all duration-150 ${
                        isActive ? 'text-white/40' : 'text-white/20'
                      }`}
                      aria-label="Close workspace tab"
                    >
                      <X size={10} />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Plus Button to add tab - Pinned to the right */}
      <Tooltip content={<HotkeyHint label="New workspace tab" keys="N" />} position="bottom" autoAlign={false}>
        <button
          onClick={() => setIsInputModalOpen(true)}
          className="flex items-center justify-center p-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 text-white/40 hover:text-white transition-all cursor-pointer shrink-0"
          aria-label="New workspace tab"
        >
          <Plus size={13} />
        </button>
      </Tooltip>
    </nav>
  );
};
