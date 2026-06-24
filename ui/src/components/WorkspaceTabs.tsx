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
import {
  RovingTabindexProvider,
  useRovingItem,
} from '../hooks/useRovingTabindex';

const formatTimestamp = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const truncateName = (name: string, maxLen = 18) => {
  if (name.length <= maxLen) return name;
  return name.substring(0, maxLen) + '...';
};

interface TabChipProps {
  tab: WorkspaceTab;
  isActive: boolean;
  isEditing: boolean;
  editName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  activeTabRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onStartEdit: (tab: WorkspaceTab) => void;
  onChangeEditName: (name: string) => void;
  onSaveRename: (tabId: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent, tabId: string) => void;
}

/**
 * A single workspace tab in the `role="tablist"` composite widget (#257).
 *
 * The whole strip is one Tab stop: this chip is `role="tab"` with a
 * roving-tabindex-driven `tabIndex`, Left/Right move between tabs, Enter/Space
 * select the workspace, and the close/rename affordances drop out of the focus
 * order — keyboard reaches them via Delete (close) and F2 (rename), advertised
 * through `aria-keyshortcuts`. Making the chip a `tab` (not a `role="button"`
 * wrapping nested `<button>`s) ends the button-in-button nesting that VoiceOver
 * demoted to "group".
 */
const TabChip: React.FC<TabChipProps> = ({
  tab,
  isActive,
  isEditing,
  editName,
  editInputRef,
  activeTabRef,
  onSelect,
  onClose,
  onStartEdit,
  onChangeEditName,
  onSaveRename,
  onEditKeyDown,
}) => {
  // Roving item: ref registers the chip, tabIndex is controller-driven, and the
  // default onKeyDown handles Left/Right/Home/End across the tablist. Only the
  // selected tab is `primary`, so the controller's default entry stop is the
  // active workspace (WAI-ARIA tablist pattern) without a separate sync effect.
  const { ref, tabIndex, onKeyDown: rovingKeyDown } = useRovingItem(tab.id, { primary: isActive });

  const stepCount = tab.historyTree ? Math.max(0, Object.keys(tab.historyTree).length - 1) : 0;
  const lastEditTime = tab.timestamp
    || (tab.historyTree
      ? Math.max(0, ...Object.values(tab.historyTree).map((n) => n.timestamp || 0))
      : 0);

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

  // Tab keyboard model (#257): selection on Enter/Space, close on Delete, rename
  // on F2, and arrow roving for everything else. Keys bubbling up from the rename
  // input are ignored (the input carries its own handler).
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        onSelect(tab.id);
        return;
      case 'Delete':
        e.preventDefault();
        onClose(tab.id);
        return;
      case 'F2':
        e.preventDefault();
        onStartEdit(tab);
        return;
      default:
        rovingKeyDown(e);
    }
  };

  const setChipRef = (el: HTMLDivElement | null) => {
    ref(el);
    if (isActive) activeTabRef.current = el;
  };

  return (
    <div
      ref={isEditing ? (isActive ? activeTabRef : undefined) : setChipRef}
      onClick={() => !isEditing && onSelect(tab.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit(tab);
      }}
      {...(isEditing
        ? {}
        : {
            role: 'tab',
            tabIndex,
            'aria-label': `Workspace: ${tab.name}`,
            // Workspaces are mutually exclusive tabs, so the active one is the
            // selected tab (aria-selected) — not an independent on/off toggle.
            'aria-selected': isActive,
            'aria-keyshortcuts': 'F2 Delete',
            onKeyDown: handleKeyDown,
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
          onChange={(e) => onChangeEditName(e.target.value)}
          onBlur={() => onSaveRename(tab.id)}
          onKeyDown={(e) => onEditKeyDown(e, tab.id)}
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

      {/* Close/rename are pointer-only affordances. They are NOT nested focusable
          buttons (which would make the tab a forbidden nested-interactive control,
          the artifact #257 set out to fix): keyboard users reach them via the
          advertised F2 / Delete shortcuts on the tab, so the icons are aria-hidden
          presentational click targets. The Tooltip still names them for the mouse. */}
      {!isEditing && (
        <div className="flex items-center gap-1" aria-hidden="true">
          {isActive && (
            <Tooltip content="Rename workspace" position="bottom" autoAlign={false}>
              <span
                role="presentation"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit(tab);
                }}
                className="hover:text-white p-0.5 rounded cursor-pointer transition-all duration-150 text-white/40"
              >
                <Pencil size={9} />
              </span>
            </Tooltip>
          )}
          <Tooltip content="Close workspace tab (⌘⌫)" position="bottom" autoAlign={false}>
            <span
              role="presentation"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className={`p-0.5 rounded hover:bg-white/10 hover:text-white cursor-pointer transition-all duration-150 ${
                isActive ? 'text-white/40' : 'text-white/20'
              }`}
            >
              <X size={10} />
            </span>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

interface TabListProps extends Omit<TabChipProps, 'tab' | 'isActive' | 'isEditing'> {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  editingTabId: string | null;
}

/**
 * The `role="tablist"` container. Each chip marks itself `primary` only when it is
 * the selected workspace, so the roving controller's default entry stop is the
 * active tab (WAI-ARIA tablist pattern): tabbing into the strip lands there, and
 * arrowing then moves focus independently (selection only changes on Enter/Space).
 */
const TabList: React.FC<TabListProps> = ({ tabs, activeTabId, editingTabId, ...chipProps }) => {
  return (
    <div
      role="tablist"
      // The wrapping <nav> landmark already announces "Workspaces"; give the
      // tablist a distinct name so a screen reader doesn't say it twice (#265).
      aria-label="Open workspaces"
      className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-1"
    >
      {tabs.map((tab) => (
        <TabChip
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          isEditing={tab.id === editingTabId}
          {...chipProps}
        />
      ))}
    </div>
  );
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

  const handleStartEdit = (tab: WorkspaceTab) => {
    setEditingTabId(tab.id);
    setEditName(tab.name);
  };

  const handleSaveRename = (tabId: string) => {
    if (editName.trim()) {
      renameTab({ tabId, name: editName.trim() });
    }
    setEditingTabId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(tabId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  return (
    // PR A's "Workspaces" navigation landmark (the rotor fast-lane) wraps PR C's
    // tablist composite widget — landmark over widget (#257).
    <nav aria-label="Workspaces" className="w-full flex items-center justify-between bg-transparent px-0 max-lg:px-3 pt-2 pb-0 gap-4 shrink-0 select-none">
      <RovingTabindexProvider>
        <TabList
          tabs={tabs}
          activeTabId={activeTabId}
          editingTabId={editingTabId}
          editName={editName}
          editInputRef={editInputRef}
          activeTabRef={activeTabRef}
          onSelect={setActiveTabId}
          onClose={closeTab}
          onStartEdit={handleStartEdit}
          onChangeEditName={setEditName}
          onSaveRename={handleSaveRename}
          onEditKeyDown={handleEditKeyDown}
        />
      </RovingTabindexProvider>

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
