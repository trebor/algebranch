import React, { useState, useRef, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Plus, X, Layers, Pencil } from 'lucide-react';
import {
  tabsAtom,
  activeTabIdAtom,
  addTabAtom,
  closeTabAtom,
  renameTabAtom,
  WorkspaceTab
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { Tooltip } from './Tooltip';

export const WorkspaceTabs: React.FC = () => {
  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);
  const [, addTab] = useAtom(addTabAtom);
  const [, closeTab] = useAtom(closeTabAtom);
  const [, renameTab] = useAtom(renameTabAtom);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

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

  const truncateName = (name: string, maxLen = 18) => {
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen) + '...';
  };

  return (
    <div className="w-full flex items-center justify-between border-b border-white/10 bg-neutral-950/40 px-2 py-1 gap-4 shrink-0 select-none">
      {/* Scrollable tab containers list */}
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;

          return (
            <div
              key={tab.id}
              onClick={() => !isEditing && setActiveTabId(tab.id)}
              onDoubleClick={(e) => handleStartEdit(e, tab)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-all duration-200 ${
                isActive
                  ? 'bg-white/10 border-indigo-500/30 text-white shadow-[0_0_12px_rgba(99,102,241,0.08)]'
                  : 'bg-transparent border-transparent text-white/50 hover:text-white/80 hover:bg-white/5'
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
                <span className="truncate max-w-[120px] tracking-wide" title={tab.name}>
                  {truncateName(tab.name)}
                </span>
              )}

              {/* Action buttons inside tab */}
              {!isEditing && (
                <div className="flex items-center gap-1">
                  {/* Small pencil icon visible on hover for active tab */}
                  {isActive && (
                    <button
                      onClick={(e) => handleStartEdit(e, tab)}
                      className="opacity-0 group-hover:opacity-100 hover:text-indigo-400 p-0.5 rounded cursor-pointer transition-all duration-150"
                      title="Rename workspace"
                    >
                      <Pencil size={9} />
                    </button>
                  )}
                  {/* Close tab button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={`p-0.5 rounded hover:bg-white/10 hover:text-white cursor-pointer transition-all duration-150 ${
                      isActive ? 'text-white/40' : 'text-white/20'
                    }`}
                    title="Close workspace tab"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Plus Button to add tab */}
        <Tooltip content="Open a new algebra workspace" position="bottom">
          <button
            onClick={() => addTab()}
            className="flex items-center justify-center p-2 rounded-lg border border-transparent hover:border-white/5 bg-transparent hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer"
          >
            <Plus size={13} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
