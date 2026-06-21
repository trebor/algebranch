// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Plus, X, Layers, Pencil, ChevronDown } from 'lucide-react';
import {
  tabsAtom,
  activeTabIdAtom,
  closeTabAtom,
  renameTabAtom,
  equationInputModalOpenAtom,
  WorkspaceTab,
} from '../store/equation';
import { Tooltip } from './Tooltip';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';

// Collapsed workspace control for short/landscape viewports (#247). The
// horizontal tab strip (WorkspaceTabs) spends the scarce vertical axis to hold a
// list that belongs in a vertical popover; below the #218 short-screen
// threshold this pill replaces it. Only one of the two mounts at a time (see the
// useIsShortScreen dispatch in WorkspaceTabs), so the tab state is never
// duplicated. It reuses the same atoms/actions — purely a presentation change.
export const WorkspaceSwitcher: React.FC = () => {
  const [tabs] = useAtom(tabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);
  const [, closeTab] = useAtom(closeTabAtom);
  const [, renameTab] = useAtom(renameTabAtom);
  const setIsInputModalOpen = useSetAtom(equationInputModalOpenAtom);

  const [open, setOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // Outside-click / Escape dismissal (mirrors CopyFormatMenu). Clearing the edit
  // state on close keeps a half-typed rename from reappearing next open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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

  const handleEditKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(tabId);
    } else if (e.key === 'Escape') {
      // Cancel the rename without also closing the popover.
      e.stopPropagation();
      setEditingTabId(null);
    }
  };

  const handleSelect = (tabId: string) => {
    setActiveTabId(tabId);
    setOpen(false);
  };

  const handleNew = () => {
    setIsInputModalOpen(true);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-flex max-w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch workspace"
        className={THEME_GLASS.WORKSPACE_SWITCHER_TRIGGER}
      >
        <Layers size={13} className="text-indigo-400 shrink-0" />
        <span className={THEME_GLASS.WORKSPACE_SWITCHER_TRIGGER_NAME}>{activeTab?.name}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div role="menu" className={THEME_GLASS.WORKSPACE_SWITCHER_MENU}>
          <div className={THEME_GLASS.WORKSPACE_SWITCHER_LIST}>
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const isEditing = tab.id === editingTabId;

              if (isEditing) {
                return (
                  <input
                    key={tab.id}
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleSaveRename(tab.id)}
                    onKeyDown={(e) => handleEditKeyDown(e, tab.id)}
                    className={THEME_GLASS.WORKSPACE_SWITCHER_EDIT_INPUT}
                  />
                );
              }

              return (
                <div
                  key={tab.id}
                  className={`${THEME_GLASS.WORKSPACE_SWITCHER_ROW} ${
                    isActive
                      ? THEME_GLASS.WORKSPACE_SWITCHER_ROW_ACTIVE
                      : THEME_GLASS.WORKSPACE_SWITCHER_ROW_INACTIVE
                  }`}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(tab.id)}
                    className={`${THEME_GLASS.WORKSPACE_SWITCHER_ROW_MAIN} ${
                      isActive ? 'text-white' : 'text-white/60'
                    }`}
                  >
                    <Layers
                      size={11}
                      className={`shrink-0 ${isActive ? 'text-indigo-400' : 'text-white/30'}`}
                    />
                    <span className={THEME_GLASS.WORKSPACE_SWITCHER_ROW_NAME}>{tab.name}</span>
                  </button>
                  <div className={THEME_GLASS.WORKSPACE_SWITCHER_ROW_ACTIONS}>
                    <Tooltip content="Rename workspace" position="bottom" autoAlign={false}>
                      <button
                        type="button"
                        onClick={(e) => handleStartEdit(e, tab)}
                        className={THEME_GLASS.WORKSPACE_SWITCHER_ROW_BTN}
                        aria-label="Rename workspace"
                      >
                        <Pencil size={11} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Close workspace tab" position="bottom" autoAlign={false}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        className={THEME_GLASS.WORKSPACE_SWITCHER_ROW_BTN}
                        aria-label="Close workspace tab"
                      >
                        <X size={12} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleNew}
            className={`${THEME_GLASS.WORKSPACE_SWITCHER_NEW} ${THEME_TRANSITIONS.FAST}`}
          >
            <Plus size={13} className="shrink-0" />
            New workspace
          </button>
        </div>
      )}
    </div>
  );
};
