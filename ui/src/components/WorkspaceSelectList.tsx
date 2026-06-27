// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import { Equation, parseEquation, ensureNodeIds, equationToString } from 'math-engine-client';
import type { SerializedHistoryNode } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { Tooltip } from './Tooltip';
import { TooltipCard } from './TooltipCard';

/**
 * Minimal workspace shape the selector needs. Both `SavedSession` (export) and
 * `ExportedWorkspace` (import) satisfy it, so one component drives both modals
 * (#203). A `disabled` entry is shown greyed-out and cannot be selected (used
 * for import duplicates already present in the library).
 */
export interface SelectableWorkspace {
  id: string;
  name: string;
  timestamp: number;
  tree: Record<string, SerializedHistoryNode>;
  currentNodeId: string;
  /** When true the row is non-selectable (e.g. an import duplicate). */
  disabled?: boolean;
  /** Tooltip eyebrow explaining why the row is disabled. */
  disabledReason?: string;
}

interface WorkspaceSelectListProps {
  workspaces: SelectableWorkspace[];
  /** Set of currently-checked workspace ids. */
  selected: Set<string>;
  /** Called with the full next selection (toggle / select-all / clear-all). */
  onSelectionChange: (next: Set<string>) => void;
  /** Empty-state message when there are no workspaces to show. */
  emptyMessage: string;
}

const stepCount = (tree: Record<string, unknown> | undefined | null): number => {
  if (!tree) return 0;
  return Math.max(0, Object.keys(tree).length - 1);
};

/** Deserialize the workspace's current node into an Equation for typeset preview. */
const previewEquation = (ws: SelectableWorkspace): Equation | null => {
  try {
    const node = ws.tree?.[ws.currentNodeId] ?? ws.tree?.['0'];
    if (!node) return null;
    return ensureNodeIds(parseEquation(node.equation));
  } catch {
    return null;
  }
};

const equationText = (eq: Equation | null): string => {
  if (!eq) return '';
  try {
    return equationToString(eq);
  } catch {
    return '';
  }
};

export const WorkspaceSelectList: React.FC<WorkspaceSelectListProps> = ({
  workspaces,
  selected,
  onSelectionChange,
  emptyMessage,
}) => {
  const selectableIds = useMemo(
    () => workspaces.filter(w => !w.disabled).map(w => w.id),
    [workspaces],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));

  // Precompute typeset equations + their string fallbacks once per render.
  const previews = useMemo(() => {
    const map = new Map<string, { eq: Equation | null; text: string }>();
    for (const w of workspaces) {
      const eq = previewEquation(w);
      map.set(w.id, { eq, text: equationText(eq) });
    }
    return map;
  }, [workspaces]);

  const toggle = (ws: SelectableWorkspace) => {
    if (ws.disabled) return;
    const next = new Set(selected);
    if (next.has(ws.id)) next.delete(ws.id);
    else next.add(ws.id);
    onSelectionChange(next);
  };

  if (workspaces.length === 0) {
    return (
      <p className={`text-sm ${THEME_GLASS.TEXT_MUTED_LIGHT} py-6 text-center`}>{emptyMessage}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1">
      <div className="flex items-center justify-between px-1 shrink-0">
        <span className={`text-xs font-semibold ${THEME_GLASS.TEXT_MUTED_BRIGHT}`}>
          {selected.size} of {selectableIds.length} selected
        </span>
        <button
          type="button"
          onClick={() =>
            onSelectionChange(allSelected ? new Set() : new Set(selectableIds))
          }
          disabled={selectableIds.length === 0}
          className={`${THEME_GLASS.LINK} text-xs font-bold bg-transparent border-none cursor-pointer p-0 disabled:opacity-40 disabled:pointer-events-none`}
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <ul className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0 pr-1">
        {workspaces.map(ws => {
          const isChecked = selected.has(ws.id);
          const { eq, text } = previews.get(ws.id) ?? { eq: null, text: '' };
          const steps = stepCount(ws.tree);
          const tooltip = (
            <TooltipCard
              eyebrow={ws.disabled ? (ws.disabledReason ?? 'Already in your library') : 'Workspace'}
              meta={`${steps} ${steps === 1 ? 'step' : 'steps'}`}
              title={ws.name}
              equation={eq}
              rawEquation={text}
            />
          );
          return (
            <li key={ws.id}>
              <Tooltip content={tooltip} className="!p-3 w-72 max-w-[80vw]" wrapperClassName="w-full">
                <button
                  type="button"
                  onClick={() => toggle(ws)}
                  aria-disabled={ws.disabled}
                  aria-pressed={isChecked}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all border ${
                    ws.disabled
                      ? 'bg-white/[0.01] border-white/5 opacity-50 cursor-not-allowed'
                      : isChecked
                        ? 'bg-indigo-500/10 border-indigo-400/30 cursor-pointer'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10 cursor-pointer'
                  }`}
                >
                  <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-white truncate">{ws.name}</span>
                    {text && (
                      <span className={`text-xs font-mono truncate ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                        {text}
                      </span>
                    )}
                    <span className={`text-[11px] ${THEME_GLASS.TEXT_MUTED_EXTRA}`}>
                      {steps} {steps === 1 ? 'step' : 'steps'}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                      ws.disabled
                        ? 'border-white/10 bg-white/5'
                        : isChecked
                          ? 'bg-indigo-500 border-indigo-400 text-white'
                          : 'border-white/25 bg-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    {isChecked && !ws.disabled && <Check size={11} strokeWidth={3} />}
                  </span>
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
