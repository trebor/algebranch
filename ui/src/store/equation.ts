// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { atom } from 'jotai';
import { Equation, RelationOperator, parseEquation, ensureNodeIds, getNodeByPath, replaceNodeAtPath, equationToString, equationToLatex, equationToLatexAligned, equationToUnicode, equationToSpeech, deserializeEquation, SerializedEquation, getFunctionName, flipRelation, compressString } from 'math-engine-client';
// AST transforms come from the single source of truth (the real engine),
// consumed client-side. First step toward retiring the math-engine-client shim.
import { applyGlobalOp, GlobalOpParams, StepChange, describeGlobalOp, describeSubstitution, getIsolatedDefinition, getSubstitutionOptions, getCombineOptions, SubstitutionFact, SubstitutionOption, computeGraphData, getGraphVariables, sampleCurve, findIntersections, GraphWindow } from 'math-engine';
import type * as math from 'mathjs';
import { mjs } from 'math-engine';
import { Preset, PRESET_LIST } from '../constants/presets';
import { MULTIPLY_SYMBOL } from '../constants/mathSymbols';
import { ONBOARDING_CHAPTERS } from '../constants/onboarding';
import { sentenceCase } from '../utils/text';
import { mergeWorkspaces, hashWorkspace, ExportedWorkspace } from '../utils/workspaceTransfer';
import { assignLanes } from '../utils/treeLayout';

// Global Initial Value Constants
export const INITIAL_EQUATION_STRING = '2 * (x + 3) = 10';
export const DEFAULT_TAB_ID = 'tab_initial';
export const DEFAULT_TAB_NAME = 'Sample Workspace';

// Tree Interface Definition
export interface HistoryNode {
  id: string;
  equation: Equation;
  parentId: string | null;
  childrenIds: string[];
  label: string;
  timestamp: number;
  /** Structured description of the move that produced this node (#42). */
  change?: StepChange;
}

export interface SerializedHistoryNode {
  id: string;
  equation: string;
  parentId: string | null;
  childrenIds: string[];
  label: string;
  timestamp: number;
  /** Plain serializable data — round-trips via the spread in serializeTree. */
  change?: StepChange;
}

export interface SavedSession {
  id: string;
  name: string;
  timestamp: number;
  tree: Record<string, SerializedHistoryNode>;
  currentNodeId: string;
  /** Set when this session belongs to an onboarding chapter (one per chapter). */
  chapterId?: string;
}

export const serializeTree = (tree: Record<string, HistoryNode>): Record<string, SerializedHistoryNode> => {
  const serialized: Record<string, SerializedHistoryNode> = {};
  Object.keys(tree).forEach(id => {
    serialized[id] = {
      ...tree[id],
      equation: tree[id].equation ? equationToString(tree[id].equation) : ''
    };
  });
  return serialized;
};

export const deserializeTree = (serialized: Record<string, SerializedHistoryNode>): Record<string, HistoryNode> => {
  const tree: Record<string, HistoryNode> = {};
  Object.keys(serialized).forEach(id => {
    tree[id] = {
      ...serialized[id],
      equation: ensureNodeIds(parseEquation(serialized[id].equation))
    };
  });
  return tree;
};

export interface MinifiedNode {
  i: string; // id
  e: string; // equation
  p: string | null; // parentId
  c: string[]; // childrenIds
  l: string; // label
  h?: StepChange; // change (optional)
}

export interface MinifiedWorkspace {
  v: number; // version
  t: Record<string, MinifiedNode>; // tree
  n: string; // currentNodeId
  a: string; // name
}

export const minifyWorkspace = (ws: {
  tree: Record<string, SerializedHistoryNode>;
  currentNodeId: string;
  name: string;
}): MinifiedWorkspace => {
  const { tree, currentNodeId, name } = ws;
  const idMap: Record<string, string> = {};
  let counter = 0;
  
  if ("0" in tree) {
    idMap["0"] = "0";
    counter = 1;
  }
  
  Object.keys(tree).forEach(id => {
    if (id !== "0") {
      idMap[id] = String(counter++);
    }
  });

  const minifiedTree: Record<string, MinifiedNode> = {};
  Object.keys(tree).forEach(id => {
    const node = tree[id];
    const shortId = idMap[id];
    minifiedTree[shortId] = {
      i: shortId,
      e: node.equation,
      p: node.parentId ? idMap[node.parentId] : null,
      c: node.childrenIds.map(cid => idMap[cid] || cid),
      l: node.label,
      ...(node.change ? { h: node.change } : {})
    };
  });

  return {
    v: STORAGE_SCHEMA_VERSION,
    t: minifiedTree,
    n: idMap[currentNodeId] || currentNodeId,
    a: name
  };
};

export const deminifyWorkspace = (minified: MinifiedWorkspace): {
  tree: Record<string, SerializedHistoryNode>;
  currentNodeId: string;
  name: string;
} => {
  const { t: minifiedTree, n: shortCurrentNodeId, a: name } = minified;
  const idMap: Record<string, string> = {};
  Object.keys(minifiedTree).forEach(shortId => {
    if (shortId === "0") {
      idMap["0"] = "0";
    } else {
      idMap[shortId] = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  });

  const tree: Record<string, SerializedHistoryNode> = {};
  let baseTime = Date.now() - Object.keys(minifiedTree).length * 1000;
  
  Object.keys(minifiedTree).forEach(shortId => {
    const mNode = minifiedTree[shortId];
    const fullId = idMap[shortId];
    tree[fullId] = {
      id: fullId,
      equation: mNode.e,
      parentId: mNode.p ? idMap[mNode.p] : null,
      childrenIds: mNode.c.map(scid => idMap[scid] || scid),
      label: mNode.l,
      timestamp: baseTime += 1000,
      ...(mNode.h ? { change: mNode.h } : {})
    };
  });

  return {
    tree,
    currentNodeId: idMap[shortCurrentNodeId] || shortCurrentNodeId,
    name
  };
};

/**
 * Serialize + compress the current workspace into the `?ws=` payload shared by
 * the Share menu and the Feedback flow. Returns '' when there is nothing to
 * share (no tree or no selected node), so callers can omit the link.
 */
export const serializeWorkspaceState = async (
  tree: Record<string, HistoryNode> | null,
  currentNodeId: string | null,
  name: string,
): Promise<string> => {
  if (!tree || !currentNodeId) return '';
  const serialized = serializeTree(tree);
  const minified = minifyWorkspace({ tree: serialized, currentNodeId, name });
  const stateStr = JSON.stringify(minified);
  return await compressString(stateStr);
};

export const getSessionLatestTimestamp = (tree: Record<string, HistoryNode> | Record<string, SerializedHistoryNode>): number => {
  const nodes = Object.values(tree);
  if (nodes.length === 0) return Date.now();
  let maxTs = 0;
  for (const node of nodes) {
    if (node.timestamp && node.timestamp > maxTs) {
      maxTs = node.timestamp;
    }
  }
  return maxTs > 0 ? maxTs : Date.now();
};

/**
 * Output format for copy/export (#46). `plain` is the ASCII serialization;
 * `latex` and `unicode` are the pretty serializers from the engine. Only the
 * equations are reformatted — step justifications stay plain prose.
 */
export type ExportFormat = 'plain' | 'latex' | 'unicode';

/** Serializes a single equation in the requested export format (#46). */
export const equationToFormat = (eq: Equation, format: ExportFormat): string => {
  if (format === 'latex') return equationToLatex(eq);
  if (format === 'unicode') return equationToUnicode(eq);
  return equationToString(eq);
};

/**
 * Build a human-readable transcript of the active derivation path
 * (root -> currentNodeId): numbered steps, each line the equation plus a
 * justification — the structured change description (#42), falling back to the
 * coarse label for moves that aren't descriptor-wired. The `parentId` chain is a
 * unique path (loop bubbles are off-chain); the seen-guard is belt-and-suspenders.
 *
 * `format` (#46) selects how the equations are rendered; justifications stay plain.
 */
export const formatDerivation = (
  tree: Record<string, HistoryNode>,
  currentNodeId: string,
  format: ExportFormat = 'plain',
): string => {
  const chain: HistoryNode[] = [];
  const seen = new Set<string>();
  let id: string | null = currentNodeId;
  while (id && tree[id] && !seen.has(id)) {
    seen.add(id);
    chain.push(tree[id]);
    id = tree[id].parentId;
  }
  chain.reverse();

  // The justification for a step: its structured descriptor (#42), falling back
  // to the coarse label, with any domain restrictions (#63) folded in so a copied
  // derivation never drops an assumed ≠0 condition.
  const justificationOf = (node: HistoryNode): string | undefined => {
    // Sentence-case to match the history rail (#125); see sentenceCase.
    const base = sentenceCase(node.change?.text ?? node.label);
    const assumptions = node.change?.assumptions;
    return base && assumptions?.length ? `${base}, assuming ${assumptions.join(', ')}` : base;
  };

  // LaTeX exports as a single `aligned` math block (no `$`): renders directly in
  // KaTeX/MathJax and pastes into Overleaf, unlike a numbered `$…$` transcript.
  // Reasons sit in a `&&` column so the renderer aligns them tidily (#46).
  if (format === 'latex') {
    const rows = chain.map((node, i) => {
      const justification = i === 0 ? undefined : justificationOf(node);
      return equationToLatexAligned(node.equation, justification);
    });
    return `\\begin{aligned}\n${rows.join(' \\\\\n')}\n\\end{aligned}`;
  }

  // Plain / Unicode: numbered transcript with each reason padded to a shared start
  // column so they line up under a monospace face — the column does the separating,
  // so no delimiter is needed (#46). (Unicode superscripts/√ aren't always exactly
  // one cell, so its alignment is best-effort.)
  const lines = chain.map((node, i) => ({
    left: `${i + 1}. ${equationToFormat(node.equation, format)}`,
    reason: i === 0 ? undefined : justificationOf(node),
  }));
  const reasonColumn = Math.max(0, ...lines.filter((l) => l.reason).map((l) => Array.from(l.left).length));
  const REASON_GAP = 2;
  return lines
    .map((l) => {
      if (!l.reason) return l.left;
      const pad = ' '.repeat(reasonColumn - Array.from(l.left).length + REASON_GAP);
      return `${l.left}${pad}${l.reason}`;
    })
    .join('\n');
};

/**
 * The set of node ids on the active derivation path (root -> currentNodeId),
 * walking the unique `parentId` chain. Used to highlight/dim by membership when
 * previewing what a full-derivation export will contain (#46, option B).
 */
export const getActivePathIds = (
  tree: Record<string, HistoryNode>,
  currentNodeId: string,
): Set<string> => {
  const ids = new Set<string>();
  let id: string | null = currentNodeId;
  while (id && tree[id] && !ids.has(id)) {
    ids.add(id);
    id = tree[id].parentId;
  }
  return ids;
};

/**
 * Scope summary for a full-derivation export (#46, option B): how many steps it
 * spans and the endpoint equation that defines the path. The copy menu renders
 * the endpoint typeset (#243), so this returns the `Equation`, not a string.
 */
export const getDerivationScope = (
  tree: Record<string, HistoryNode>,
  currentNodeId: string,
): { stepCount: number; endpoint: Equation | undefined } => {
  const stepCount = getActivePathIds(tree, currentNodeId).size;
  const node = tree[currentNodeId];
  return { stepCount, endpoint: node?.equation };
};

export interface VisualTreeNode extends HistoryNode {
  depth: number;
  column: number;
  x: number;
  y: number;
}

// Tree Coordinates Constants
const ROW_HEIGHT = 72;
const COL_WIDTH = 75;
const PADDING_LEFT = 40;
const PADDING_TOP = 32;

export interface WorkspaceTab {
  id: string;
  name: string;
  historyTree: Record<string, HistoryNode>;
  currentNodeId: string;
  isCustomNamed?: boolean;
  isModified?: boolean;
  sessionId?: string;
  timestamp?: number;
  /** Set when this tab belongs to an onboarding chapter (one per chapter). */
  chapterId?: string;
}

// Helper for fallback/static initial tabs
const getFallbackTabs = (): WorkspaceTab[] => [
  {
    id: DEFAULT_TAB_ID,
    name: DEFAULT_TAB_NAME,
    historyTree: {
      "0": {
        id: "0",
        equation: ensureNodeIds(parseEquation(INITIAL_EQUATION_STRING)),
        parentId: null,
        childrenIds: [],
        label: "Initial",
        timestamp: Date.now(),
      }
    },
    currentNodeId: "0",
    isCustomNamed: true,
    timestamp: Date.now(),
  }
];

// Safe wrapper around window.localStorage to prevent DOMException / SecurityError crashes on mobile browsers (incognito, LAN HTTP, etc.)
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('localStorage.getItem access denied:', e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('localStorage.setItem access denied:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('localStorage.removeItem access denied:', e);
    }
  }
};

// Internal raw atoms (always initialized to static fallback to prevent Next.js SSR hydration mismatches)
export const rawTabsAtom = atom<WorkspaceTab[]>(getFallbackTabs());
export const rawActiveTabIdAtom = atom<string>('tab_initial');

export const STORAGE_SCHEMA_VERSION = 1;

export interface VersionedPayload<T> {
  version: number;
  payload: T;
}

export const wrapVersioned = <T>(payload: T): VersionedPayload<T> => ({
  version: STORAGE_SCHEMA_VERSION,
  payload,
});

export const unwrapVersioned = <T>(jsonStr: string | null): T | null => {
  if (!jsonStr) return null;
  const trimmed = jsonStr.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    const envelope = JSON.parse(trimmed);
    if (envelope && envelope.version === STORAGE_SCHEMA_VERSION) {
      return envelope.payload as T;
    }
  } catch (err) {
    console.error('Failed to parse versioned payload:', err);
  }
  return null;
};

// Helper to save tabs to localStorage
const saveTabsToLocalStorage = (tabs: WorkspaceTab[], activeId: string) => {
  if (typeof window !== 'undefined') {
    try {
      const serialized = tabs.map(tab => ({
        ...tab,
        historyTree: serializeTree(tab.historyTree)
      }));
      safeLocalStorage.setItem('algebranch_workspace_tabs', JSON.stringify(wrapVersioned(serialized)));
      safeLocalStorage.setItem('algebranch_active_tab_id', activeId);
    } catch (err) {
      console.error('Failed to save workspace tabs to localStorage:', err);
    }
  }
};

// Base Atoms
export const tabsAtom = atom(
  (get) => get(rawTabsAtom),
  (get, set, update: WorkspaceTab[] | ((prev: WorkspaceTab[]) => WorkspaceTab[])) => {
    const prev = get(rawTabsAtom);
    const next = typeof update === 'function' ? update(prev) : update;
    set(rawTabsAtom, next);
    saveTabsToLocalStorage(next, get(activeTabIdAtom));
  }
);

export const activeTabIdAtom = atom(
  (get) => {
    const rawActiveId = get(rawActiveTabIdAtom);
    const tabs = get(rawTabsAtom);
    if (tabs.length > 0 && !tabs.some(t => t.id === rawActiveId)) {
      return tabs[0].id;
    }
    return rawActiveId;
  },
  (get, set, update: string | ((prev: string) => string)) => {
    const prev = get(rawActiveTabIdAtom);
    const next = typeof update === 'function' ? update(prev) : update;
    set(rawActiveTabIdAtom, next);
    saveTabsToLocalStorage(get(rawTabsAtom), next);
  }
);

export type ZoomMode = 'normal' | 'fit-width' | 'full-tree';

/** In-memory map tracking the ZoomMode for each workspace tab during the session */
export const workspaceZoomModesAtom = atom<Record<string, ZoomMode>>({});

/** Writable derived atom that gets/sets the ZoomMode for the currently active workspace */
export const activeZoomModeAtom = atom<ZoomMode, [ZoomMode | ((prev: ZoomMode) => ZoomMode)], void>(
  (get) => {
    const activeTabId = get(activeTabIdAtom);
    const modes = get(workspaceZoomModesAtom);
    return modes[activeTabId] ?? 'normal';
  },
  (get, set, update) => {
    const activeTabId = get(activeTabIdAtom);
    const prev = get(workspaceZoomModesAtom);
    const current = prev[activeTabId] ?? 'normal';
    const next = typeof update === 'function' ? update(current) : update;
    set(workspaceZoomModesAtom, { ...prev, [activeTabId]: next });
  }
);


export const historyTreeAtom = atom(
  (get) => {
    const tabs = get(tabsAtom);
    const activeId = get(activeTabIdAtom);
    const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
    return activeTab?.historyTree || {};
  },
  (get, set, update: Record<string, HistoryNode> | ((prev: Record<string, HistoryNode>) => Record<string, HistoryNode>)) => {
    const tabs = get(tabsAtom);
    const activeId = get(activeTabIdAtom);
    const updatedTabs = tabs.map(t => {
      if (t.id === activeId) {
        const nextTree = typeof update === 'function' ? update(t.historyTree) : update;
        const activeNode = nextTree[t.currentNodeId];
        const tabName = t.isCustomNamed
          ? t.name
          : (activeNode ? equationToString(activeNode.equation) : t.name);
        return {
          ...t,
          historyTree: nextTree,
          name: tabName,
          isModified: true,
          timestamp: Date.now()
        };
      }
      return t;
    });
    set(tabsAtom, updatedTabs);
  }
);

export const currentNodeIdAtom = atom(
  (get) => {
    const tabs = get(tabsAtom);
    const activeId = get(activeTabIdAtom);
    const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
    return activeTab?.currentNodeId || "0";
  },
  (get, set, update: string | ((prev: string) => string)) => {
    const tabs = get(tabsAtom);
    const activeId = get(activeTabIdAtom);
    const updatedTabs = tabs.map(t => {
      if (t.id === activeId) {
        const nextNodeId = typeof update === 'function' ? update(t.currentNodeId) : update;
        const activeNode = t.historyTree[nextNodeId];
        const tabName = t.isCustomNamed
          ? t.name
          : (activeNode ? equationToString(activeNode.equation) : t.name);
        return {
          ...t,
          currentNodeId: nextNodeId,
          name: tabName
        };
      }
      return t;
    });
    set(tabsAtom, updatedTabs);
  }
);

export const currentTabNameAtom = atom<string>((get) => {
  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
  return activeTab?.name || 'Sample Workspace';
});

// Saved sessions state
export const savedSessionsAtom = atom<SavedSession[]>([]);

// True once the main client-side hydration (tabs + saved sessions) has run.
// Consumers that mutate persisted workspace state on mount (e.g. the onboarding
// auto-resume) must wait for this so they don't clobber localStorage with a
// pre-hydration empty state.
export const appHydratedAtom = atom<boolean>(false);
export const rawCurrentSessionIdAtom = atom<string>("session_initial");

export const currentSessionIdAtom = atom(
  (get) => {
    const tabs = get(tabsAtom);
    const activeId = get(activeTabIdAtom);
    const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
    return activeTab?.sessionId || get(rawCurrentSessionIdAtom);
  },
  (get, set, update: string | ((prev: string) => string)) => {
    const tabs = get(tabsAtom);
    const activeId = get(activeTabIdAtom);
    const updatedTabs = tabs.map(t => {
      if (t.id === activeId) {
        const nextSessionId = typeof update === 'function' ? update(t.sessionId || "session_initial") : update;
        return {
          ...t,
          sessionId: nextSessionId
        };
      }
      return t;
    });
    set(tabsAtom, updatedTabs);
    const nextSessionId = typeof update === 'function' ? update(get(rawCurrentSessionIdAtom)) : update;
    set(rawCurrentSessionIdAtom, nextSessionId);
  }
);

// Presets state atoms
export const presetsAtom = atom<Preset[]>(PRESET_LIST);

// Library search query (#54). Trimmed/lowercased matching happens in the
// filtered atom; the raw string is kept here so the input stays controlled.
export const presetSearchQueryAtom = atom<string>('');

/**
 * Presets matching the current search query, filtered across label, category,
 * equation string, and the variable/function symbols in the equation. An empty
 * query returns the full list. Multiple whitespace-separated terms must all
 * match (AND), so "quad fraction" narrows progressively.
 */
export const filteredPresetsAtom = atom<Preset[]>((get) => {
  const presets = get(presetsAtom);
  const query = get(presetSearchQueryAtom).trim().toLowerCase();
  if (!query) return presets;

  const terms = query.split(/\s+/);
  return presets.filter((p) => {
    // Text fields keep their spacing for ordinary word matching. The equation is
    // also matched with all whitespace removed, so "x+4" finds the stored
    // "x + 4" and "x^2" finds "x ^ 2". (Matching is already case-insensitive.)
    const text = `${p.label} ${p.category} ${p.equation} ${p.description}`.toLowerCase();
    const eqCompact = p.equation.replace(/\s+/g, '').toLowerCase();
    return terms.every((term) => text.includes(term) || eqCompact.includes(term));
  });
});

export interface PresetCategoryGroup {
  category: string;
  presets: Preset[];
}

// Groups the *filtered* presets (#54) so search narrows the accordion live.
export const presetCategoriesAtom = atom<PresetCategoryGroup[]>((get) => {
  const presets = get(filteredPresetsAtom);
  const groups: Record<string, Preset[]> = {};

  presets.forEach((p) => {
    if (!groups[p.category]) {
      groups[p.category] = [];
    }
    groups[p.category].push(p);
  });

  return Object.entries(groups).map(([category, items]) => ({
    category,
    presets: items,
  }));
});

export const sourcePathAtom = atom<string | null>(null);
export const hoverPathAtom = atom<string | null>(null);
export const hoverReducePathAtom = atom<string | null>(null);
export const hoverReduceIndexAtom = atom<number | null>(null);
export const hoveredLoopTargetIdAtom = atom<string | null>(null);
// True while the user hovers a full-derivation copy trigger; the history tree
// dims off-path nodes so the export scope (root -> selected) is visible (#46).
export const exportPreviewActiveAtom = atom(false);
export const leftSidebarOpenAtom = atom(true);

// Right Sidebar layout size state: 'hidden' | 'normal' (1/3 width, w-80) | 'wider' (middle width, w-[30rem])
export const rawRightSidebarSizeAtom = atom<'hidden' | 'normal' | 'wider'>('normal');
export const previousRightSidebarSizeAtom = atom<'hidden' | 'normal' | 'wider'>('normal');

export const rightSidebarSizeAtom = atom(
  (get) => get(rawRightSidebarSizeAtom),
  (get, set, newValue: 'hidden' | 'normal' | 'wider') => {
    const current = get(rawRightSidebarSizeAtom);
    if (current !== newValue) {
      set(previousRightSidebarSizeAtom, current);
      set(rawRightSidebarSizeAtom, newValue);
    }
  }
);

export const rightSidebarOpenAtom = atom(
  (get) => get(rawRightSidebarSizeAtom) !== 'hidden',
  (get, set, open: boolean | ((prev: boolean) => boolean)) => {
    const prevOpen = get(rawRightSidebarSizeAtom) !== 'hidden';
    const nextOpen = typeof open === 'function' ? open(prevOpen) : open;
    if (nextOpen) {
      set(rightSidebarSizeAtom, 'normal');
    } else {
      set(rightSidebarSizeAtom, 'hidden');
    }
  }
);
export const feedbackModalOpenAtom = atom(false);
export const feedbackContextAtom = atom<string | null>(null);
export const deleteConfirmationModalOpenAtom = atom(false);
export const resetHistoryModalOpenAtom = atom(false);
export const equationInputModalOpenAtom = atom(false);

// Immersive hide-chrome state (#252). On tight landscape viewports the user can
// retreat the header + BottomNav so nearly the full height goes to the
// expression. Deliberately a plain (non-persisted) atom: the preference is
// transient per session, so a reload always returns to chrome-shown and no
// cold-load can strand the user with hidden chrome. `useImmersiveChrome` gates
// this behind the short-screen breakpoint and resets it on leave.
export const immersiveAtom = atom(false);

// Mobile UI state atoms
export type BottomSheetType = 'workspace' | 'history' | 'library' | null;
export const activeBottomSheetAtom = atom<BottomSheetType>(null);
export const radialMenuOpenAtom = atom(false);


export interface ReducibleActionInfo {
  equation: Equation;
  type: 'reduce' | 'distribute' | 'identity';
  label?: string;
}

// Dynamic Server-Synchronized Atoms
export const candidatePathsAtom = atom<Set<string>>(new Set<string>());
export const targetPathsAtom = atom<Record<string, Equation>>({});
export const reduciblePathsAtom = atom<Record<string, ReducibleActionInfo[]>>({});

export interface UserSettings {
  allowEvaluateToDecimal: boolean;
  seenEqualsHint: boolean;
  /**
   * Accessibility text-size knob (#239). Multiplies the root rem so all
   * rem-based chrome (menus, tooltips, labels, badges) scales up for readability
   * without touching the auto-fitting equation canvas. 1 = browser default.
   */
  chromeScale: number;
}

/** No-op chrome scale: honor the browser/OS font-size preference unchanged. */
export const CHROME_SCALE_DEFAULT = 1;

/**
 * Discrete steps for the in-app text-size control (#239), ascending. Kept
 * discrete (not a free slider) so the choice maps to predictable, tested layout
 * snapshots and reads as an accessible radio group. Labels are sentence case.
 */
export const TEXT_SIZE_OPTIONS = [
  { label: 'Default', scale: CHROME_SCALE_DEFAULT },
  { label: 'Large', scale: 1.15 },
  { label: 'Larger', scale: 1.3 },
  { label: 'Largest', scale: 1.5 },
] as const;

/**
 * Coerce any persisted/incoming chrome scale to a safe in-range number. Guards
 * against junk from older builds or hand-edited localStorage and clamps to the
 * supported range so the root rem can never be driven to an unusable extreme.
 */
export function clampChromeScale(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return CHROME_SCALE_DEFAULT;
  }
  const min = TEXT_SIZE_OPTIONS[0].scale;
  const max = TEXT_SIZE_OPTIONS[TEXT_SIZE_OPTIONS.length - 1].scale;
  return Math.max(min, Math.min(max, value));
}

/**
 * Step to the next text-size option, wrapping around the ends — backing the
 * `T` / `Shift+T` hotkey (#239). Wrapping is intentional: tapping `T` past the
 * largest rolls back to the smallest, so a user who overshoots can simply keep
 * pressing the same key to come back around to what they want. The incoming
 * value is clamped and snapped to the nearest known option first, so an
 * off-grid or junk scale still cycles predictably. `direction` is +1 (larger)
 * or -1 (smaller).
 */
export function cycleChromeScale(current: number, direction: 1 | -1 = 1): number {
  const scales: number[] = TEXT_SIZE_OPTIONS.map((o) => o.scale);
  const clamped = clampChromeScale(current);
  let idx = scales.indexOf(clamped);
  if (idx === -1) {
    idx = scales.reduce(
      (best, s, i) => (Math.abs(s - clamped) < Math.abs(scales[best] - clamped) ? i : best),
      0,
    );
  }
  const next = (idx + direction + scales.length) % scales.length;
  return scales[next];
}

export const DEFAULT_SETTINGS: UserSettings = {
  allowEvaluateToDecimal: true,
  seenEqualsHint: false,
  chromeScale: CHROME_SCALE_DEFAULT,
};

export const settingsModalOpenAtom = atom(false);
export const aboutModalOpenAtom = atom(false);
// Keyboard-shortcuts cheat-sheet overlay (#126), opened with `k`.
export const shortcutsOverlayOpenAtom = atom(false);
// Help modal (#48), opened with `?`.
export const helpModalOpenAtom = atom(false);
// Workspace export / import modals (#203), opened from Settings.
export const exportWorkspacesModalOpenAtom = atom(false);
export const importWorkspacesModalOpenAtom = atom(false);

/**
 * True when any blocking modal/overlay is open. Global keyboard shortcuts read
 * this to suppress themselves so a bare-key binding (e.g. `g`, `?`) can't act on
 * the obscured app behind a dialog. Keep this list in sync as modals are added.
 */
export const anyModalOpenAtom = atom<boolean>((get) =>
  get(feedbackModalOpenAtom) ||
  get(deleteConfirmationModalOpenAtom) ||
  get(resetHistoryModalOpenAtom) ||
  get(equationInputModalOpenAtom) ||
  get(settingsModalOpenAtom) ||
  get(aboutModalOpenAtom) ||
  get(shortcutsOverlayOpenAtom) ||
  get(helpModalOpenAtom) ||
  get(exportWorkspacesModalOpenAtom) ||
  get(importWorkspacesModalOpenAtom)
);

export const pwaInstallPromptAtom = atom<unknown>(null);
export const rawSettingsAtom = atom<UserSettings>(DEFAULT_SETTINGS);

export const settingsAtom = atom(
  (get) => get(rawSettingsAtom),
  (get, set, update: UserSettings | ((prev: UserSettings) => UserSettings)) => {
    const prev = get(rawSettingsAtom);
    const next = typeof update === 'function' ? update(prev) : update;
    set(rawSettingsAtom, next);
    if (typeof window !== 'undefined') {
      try {
        safeLocalStorage.setItem('algebranch_settings', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save settings to localStorage:', err);
      }
    }
  }
);

export const filteredReduciblePathsAtom = atom<Record<string, ReducibleActionInfo[]>>((get) => {
  const settings = get(settingsAtom);
  const reduciblePaths = get(reduciblePathsAtom);
  if (settings.allowEvaluateToDecimal) {
    return reduciblePaths;
  }
  const filtered: Record<string, ReducibleActionInfo[]> = {};
  Object.keys(reduciblePaths).forEach((path) => {
    const filteredActions = reduciblePaths[path].filter(
      (action) => action.label !== 'Evaluate to Decimal'
    );
    if (filteredActions.length > 0) {
      filtered[path] = filteredActions;
    }
  });
  return filtered;
});

// Derived Atoms

/**
 * Returns the current active Equation based on step history tree pointer.
 */
export const currentEquationAtom = atom<Equation>((get) => {
  const tree = get(historyTreeAtom);
  const nodeId = get(currentNodeIdAtom);
  return tree[nodeId]?.equation;
});

// Graph layout size state: 'hidden' | 'split' (1/3 height) | 'expand' (2/3 height)
export const rawGraphSizeAtom = atom<'hidden' | 'split' | 'expand'>('hidden');
export const previousGraphSizeAtom = atom<'hidden' | 'split' | 'expand'>('hidden');
export const graphSizeAtom = atom(
  (get) => get(rawGraphSizeAtom),
  (get, set, newValue: 'hidden' | 'split' | 'expand') => {
    const current = get(rawGraphSizeAtom);
    if (current !== newValue) {
      set(previousGraphSizeAtom, current);
      set(rawGraphSizeAtom, newValue);
      safeLocalStorage.setItem('algebranch_graph_size', newValue);
    }
  }
);

// Custom graph viewport overridden by user panning. Reset to null on equation changes.
export const customViewportAtom = atom<GraphWindow | null>(null);

// Graph of the current equation, computed client-side via the unified engine
export const graphDataAtom = atom((get) => {
  const eq = get(currentEquationAtom);
  if (!eq) return null;
  const customViewport = get(customViewportAtom);
  try {
    const defaultData = computeGraphData(eq);
    if (!customViewport || !defaultData.variable) {
      return defaultData;
    }
    const { variable, variables } = defaultData;
    const count = 241;
    const lhs = sampleCurve(eq.lhs, variable, customViewport.xMin, customViewport.xMax, count);
    const rhs = sampleCurve(eq.rhs, variable, customViewport.xMin, customViewport.xMax, count);
    const intersections = findIntersections(eq, variable, customViewport.xMin, customViewport.xMax);
    return {
      variable,
      variables,
      lhs,
      rhs,
      intersections,
      window: customViewport
    };
  } catch {
    return null;
  }
});

/**
 * Whether the current equation can be legitimately graphed: today that means a
 * single graph variable (the grapher plots one variable against value). Drives
 * whether the graph toggle is offered at all. Cheap — counts variables only, no
 * curve sampling — so it's safe to read even while the graph panel is closed.
 * When multi-variable graphing lands, relax this to also allow >1.
 */
export const isGraphViableAtom = atom((get) => {
  const eq = get(currentEquationAtom);
  return !!eq && getGraphVariables(eq).length === 1;
});

// ==========================================
// Substitution facts (#3)
// ==========================================

/**
 * Facts injected by a tutorial chapter (simulating "solved in another
 * workspace" without multi-workspace tutorial machinery). Empty otherwise.
 */
export const tutorialFactsAtom = atom<SubstitutionFact[]>([]);

/**
 * Substitution facts available to the active workspace: every OTHER tab whose
 * current equation isolates a variable (y = <expr> with y absent from <expr>)
 * contributes a fact, with the tab as provenance. Derived live from tabs — no
 * separate persisted state to drift.
 */
export const availableFactsAtom = atom<SubstitutionFact[]>((get) => {
  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  const facts: SubstitutionFact[] = [...get(tutorialFactsAtom)];
  for (const tab of tabs) {
    if (tab.id === activeId) continue; // substituting a tab into itself is circular
    const node = tab.historyTree?.[tab.currentNodeId];
    if (!node?.equation) continue;
    try {
      const def = getIsolatedDefinition(node.equation);
      if (def) facts.push({ ...def, sourceId: tab.id, sourceName: tab.name });
    } catch {
      /* skip malformed tabs */
    }
  }

  // Workspaces asserting the IDENTICAL definition are one fact with several
  // witnesses — collapse them (merging provenance) so the strip shows one chip
  // and the handle applies directly instead of opening a chooser. Commutative
  // variants (2*x vs x*2) stay separate: their substituted results differ.
  const merged = new Map<string, SubstitutionFact>();
  for (const fact of facts) {
    const key = `${fact.variable} = ${fact.expression.toString()}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, fact);
    } else if (fact.sourceName && existing.sourceName && existing.sourceName !== fact.sourceName) {
      merged.set(key, { ...existing, sourceName: `${existing.sourceName}, ${fact.sourceName}` });
    }
  }
  return Array.from(merged.values());
});

/**
 * Substitution options for the current equation, grouped by node path.
 * Computed client-side via the unified engine (#44) — no API round-trip.
 */
export const substitutionPathsAtom = atom<Record<string, SubstitutionOption[]>>((get) => {
  const eq = get(currentEquationAtom);
  const facts = get(availableFactsAtom);
  if (!eq || facts.length === 0) return {};
  try {
    const forwards = getSubstitutionOptions(eq, facts);
    const reverses = getCombineOptions(eq, facts);

    const merged: Record<string, SubstitutionOption[]> = { ...forwards };
    for (const [path, options] of Object.entries(reverses)) {
      if (merged[path]) {
        merged[path] = [...merged[path], ...options];
      } else {
        merged[path] = options;
      }
    }
    return merged;
  } catch {
    return {};
  }
});

/**
 * Filtered substitution facts that are actually applicable to the current equation
 * (i.e. those that have at least one valid substitution or combination option).
 */
export const applicableFactsAtom = atom<SubstitutionFact[]>((get) => {
  const allFacts = get(availableFactsAtom);
  const pathsRecord = get(substitutionPathsAtom);
  
  const usedKeys = new Set<string>();
  for (const options of Object.values(pathsRecord)) {
    for (const option of options) {
      if (option.fact) {
        usedKeys.add(`${option.fact.variable} = ${option.fact.expression.toString()}`);
      }
    }
  }
  
  return allFacts.filter(fact => 
    usedKeys.has(`${fact.variable} = ${fact.expression.toString()}`)
  );
});

/**
 * Computes the absolute layout coordinates of the tree using DFS.
 */
export const treeLayoutAtom = atom<Record<string, VisualTreeNode>>((get) => {
  const tree = get(historyTreeAtom);
  // Lane-based columns: the first child continues its parent's column straight
  // down, later children branch right, and a dead branch's lane is reclaimed by
  // a later branch instead of sprawling rightward (#304). The renderer positions
  // cards from `column`; the px x/y here are a coarse fallback for any consumer
  // that reads them directly.
  const lanes = assignLanes(tree, "0");
  const result: Record<string, VisualTreeNode> = {};
  for (const [id, { depth, column }] of Object.entries(lanes)) {
    result[id] = {
      ...tree[id],
      depth,
      column,
      x: PADDING_LEFT + column * COL_WIDTH,
      y: PADDING_TOP + depth * ROW_HEIGHT,
    };
  }
  return result;
});



const normalizeAST = (node: math.MathNode): math.MathNode => {
  if (!node) return node;

  if (node.type === 'OperatorNode') {
    const opNode = node as math.OperatorNode;
    const normalizedArgs = opNode.args.map(arg => normalizeAST(arg));
    if (opNode.op === '+' || opNode.op === '*') {
      // Commutative sorting of arguments based on their string representation
      normalizedArgs.sort((a, b) => a.toString().localeCompare(b.toString()));
    }
    return new mjs.OperatorNode(opNode.op, opNode.fn, normalizedArgs);
  }

  if (node.type === 'ParenthesisNode') {
    const parenNode = node as math.ParenthesisNode;
    return new mjs.ParenthesisNode(normalizeAST(parenNode.content));
  }

  if (node.type === 'FunctionNode') {
    const fnNode = node as math.FunctionNode;
    const normalizedArgs = fnNode.args.map(arg => normalizeAST(arg));
    return new mjs.FunctionNode(getFunctionName(fnNode), normalizedArgs);
  }

  return node;
};

// Canonicalization Helper to detect structurally & commutatively identical equations in history
export const getCanonicalKey = (eqVal: Equation): string => {
  try {
    const normLhs = normalizeAST(eqVal.lhs);
    const normRhs = normalizeAST(eqVal.rhs);
    return `${normLhs.toString()} = ${normRhs.toString()}`;
  } catch {
    return equationToString(eqVal);
  }
};

// Polite screen-reader narration of the most recently applied transform (#231).
// A visually-hidden role="status" region in page.tsx reads this so a screen
// reader speaks each step's result; every apply funnels through pushEquationAtom,
// so setting it there covers transposition, reduce/distribute/identity,
// substitution, toggle-root, and the global both-sides operations alike.
export const liveAnnouncementAtom = atom<string>('');

// Assertive nav read-out for the Interaction-mode tree (#270). VoiceOver won't
// re-announce a term when keyboard focus moves UP to its ENCLOSING treeitem — the
// parent contains the child you came from, so VO announces "group" and goes quiet on
// the label (the #271 ancestor-containment quirk). On those step-out moves only, the
// roving handlers push the destination's label here for a live region to speak; a
// toggled zero-width marker forces re-announcement even when the text repeats.
export const navReadoutAtom = atom<string>('');
export const announceNavAtom = atom(null, (get, set, text: string) => {
  const marker = get(navReadoutAtom).endsWith('\u200B') ? '' : '\u200B';
  set(navReadoutAtom, text + marker);
});

// Which of the two equation-reading intents the workspace is in (#270):
//  - false (default) = Interaction mode: the #257 actionable-term roving tree, for
//    hunting move handles and transforming the equation.
//  - true = Exploration mode: a clean, handle-free rendering the user walks
//    hierarchically (Left/Right between siblings, Down/Up in/out of a term's parts)
//    to understand the equation's structure by ear. A distinct intent — reading,
//    not acting — so it gets its own navigation model and visuals.
export const explorationModeAtom = atom<boolean>(false);

// Nonce that requests keyboard focus be moved to the first actionable term in
// the equation tree (#231). Bumped by explicit user edits (the equation-input
// modal submit) where focus sits outside the tree, so useEquationTreeFocus
// refocuses regardless of its focus-within guard.
export const treeRefocusNonceAtom = atom<number>(0);
export const requestTreeRefocusAtom = atom(null, (get, set) => {
  set(treeRefocusNonceAtom, get(treeRefocusNonceAtom) + 1);
});

// Write-only Actions

/**
 * Push a new equation state to the step history tree.
 */
export const pushEquationAtom = atom(
  null,
  (get, set, newEq: Equation, stepLabel?: string, change?: StepChange) => {
    // Narrate the applied step before any early return so loop/existing-child
    // branches announce too.
    set(liveAnnouncementAtom, `${stepLabel ? `${stepLabel}: ` : ''}${equationToSpeech(newEq)}`);

    const tree = get(historyTreeAtom);
    const currentNodeId = get(currentNodeIdAtom);
    const activeNode = tree[currentNodeId];

    const newCanonical = getCanonicalKey(newEq);

    // 1. Find the earliest node in the entire history tree that is canonically equivalent to newEq (Loop Detection)
    let loopAncestorId: string | null = null;
    let earliestTimestamp = Infinity;
    
    Object.values(tree).forEach(node => {
      if (getCanonicalKey(node.equation) === newCanonical) {
        if (node.timestamp < earliestTimestamp) {
          earliestTimestamp = node.timestamp;
          loopAncestorId = node.id;
        }
      }
    });

    // 2. Check if a child matching this canonical key already exists
    let existingChildId: string | undefined;
    if (activeNode) {
      existingChildId = activeNode.childrenIds.find(childId => {
        const childNode = tree[childId];
        return childNode && getCanonicalKey(childNode.equation) === newCanonical;
      });
    }

    if (loopAncestorId) {
      // Loop Detected!
      if (existingChildId) {
        // If the loop node child already exists, jump selection directly to the loop ancestor node
        set(currentNodeIdAtom, loopAncestorId);
        set(sourcePathAtom, null);
        set(hoverPathAtom, null);
        set(hoverReducePathAtom, null);
        set(hoverReduceIndexAtom, null);
        set(hoveredLoopTargetIdAtom, null);
        return;
      }
      
      // Otherwise, we need to create the loop node under the parent, but redirect active selection to the loop ancestor node
    } else {
      // Normal state progression (No Loop)
      if (existingChildId) {
        // Transition down the existing progress branch node
        set(currentNodeIdAtom, existingChildId);
        set(sourcePathAtom, null);
        set(hoverPathAtom, null);
        set(hoverReducePathAtom, null);
        set(hoverReduceIndexAtom, null);
        set(hoveredLoopTargetIdAtom, null);
        return;
      }
    }

    // Node creation path (either a new loop bubble or a new progress node)
    let label = stepLabel || "Move";
    if (!stepLabel) {
      const hoverReducePath = get(hoverReducePathAtom);
      const hoverReduceIndex = get(hoverReduceIndexAtom);
      if (hoverReducePath) {
        const reducible = get(filteredReduciblePathsAtom);
        const actions = reducible[hoverReducePath];
        const index = hoverReduceIndex !== null ? hoverReduceIndex : 0;
        const action = actions?.[index];
        if (action) {
          const actionType = action.type;
          label = action.label || (actionType === 'distribute' ? 'Distribute' : 'Simplify');
        }
      } else if (get(sourcePathAtom)) {
        label = "Transpose";
      }
    }

    const newId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode: HistoryNode = {
      id: newId,
      equation: ensureNodeIds(newEq),
      parentId: currentNodeId,
      childrenIds: [],
      label,
      timestamp: Date.now(),
      change,
    };

    const updatedTree = {
      ...tree,
      [newId]: newNode,
      [currentNodeId]: {
        ...tree[currentNodeId],
        childrenIds: [...tree[currentNodeId].childrenIds, newId],
      },
    };

    set(historyTreeAtom, updatedTree);
    
    if (loopAncestorId) {
      // Loop detected: select the loop ancestor node directly
      set(currentNodeIdAtom, loopAncestorId);
    } else {
      // Normal state progression: select the newly created progress node
      set(currentNodeIdAtom, newId);
    }

    set(sourcePathAtom, null);
    set(hoverPathAtom, null);
    set(hoverReducePathAtom, null);
    set(hoverReduceIndexAtom, null);
    set(hoveredLoopTargetIdAtom, null);
  }
);

/**
 * Action: Create a new blank session.
 */
export const createNewSessionAtom = atom(
  null,
  (get, set, initialEqStr?: string, customName?: string, options?: { dedupe?: boolean }) => {
    const eqStr = initialEqStr || INITIAL_EQUATION_STRING;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tabName = customName || eqStr;

    try {
      const newEq = ensureNodeIds(parseEquation(eqStr));
      const newTree: Record<string, HistoryNode> = {
        "0": {
          id: "0",
          equation: newEq,
          parentId: null,
          childrenIds: [],
          label: "Initial",
          timestamp: Date.now(),
        }
      };

      // Share-link arrival dedupe (#299): when opening a `?eq=` link, if an
      // untouched (pristine) workspace built from the same equation already
      // exists, open it instead of spawning a duplicate. We compare canonical
      // equation strings rather than a content hash because a rebuilt tree gets
      // fresh node timestamps — only the equation itself is stable. "Pristine" =
      // a single root node with no derivation steps, so a further-derived
      // workspace that merely started from this equation is never hijacked.
      if (options?.dedupe) {
        const candidateEq = equationToString(newEq);
        const match = get(savedSessionsAtom).find(s => {
          const nodeIds = Object.keys(s.tree);
          if (nodeIds.length !== 1) return false;
          const root = s.tree[nodeIds[0]];
          if (root.childrenIds && root.childrenIds.length > 0) return false;
          try {
            return root.equation === candidateEq;
          } catch {
            return false;
          }
        });
        if (match) {
          set(loadSessionAtom, match.id);
          set(toastAtom, { message: "You already have this workspace — opened it.", key: Date.now() });
          return { matched: true };
        }
      }

      // Create a brand new workspace tab and select it
      const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTab: WorkspaceTab = {
        id: newTabId,
        name: tabName,
        historyTree: newTree,
        currentNodeId: "0",
        isCustomNamed: !!customName,
        sessionId: newId,
        timestamp: Date.now()
      };

      const prevTabs = get(tabsAtom);
      const isOnlyDefaultTab = prevTabs.length === 1 && prevTabs[0].id === 'tab_initial' && !prevTabs[0].isModified;
      if (isOnlyDefaultTab) {
        set(tabsAtom, [newTab]);
      } else {
        set(tabsAtom, [...prevTabs, newTab]);
      }
      set(activeTabIdAtom, newTabId);

      set(currentSessionIdAtom, newId);
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
      set(hoverReduceIndexAtom, null);
      set(hoveredLoopTargetIdAtom, null);

      // Show transient status toast message
      set(toastAtom, { message: "Created new workspace", key: Date.now() });

      // Add to saved sessions list immediately
      const sessions = get(savedSessionsAtom);
      const newSession: SavedSession = {
        id: newId,
        name: eqStr,
        timestamp: Date.now(),
        tree: serializeTree(newTree),
        currentNodeId: "0",
      };
      const updatedSessions = [newSession, ...sessions];
      set(savedSessionsAtom, updatedSessions);

      try {
        safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned(updatedSessions)));
        safeLocalStorage.setItem('algebranch_current_session_id', newId);
      } catch (err) {
        console.error('Failed to save sessions to localStorage:', err);
      }
      return { matched: false };
    } catch (err) {
      console.error('Failed to create new session:', err);
      return { matched: false };
    }
  }
);

/**
 * Action: Create a new session from a shared tree and current node.
 */
export const createSessionFromStateAtom = atom(
  null,
  (get, set, params: { tree: Record<string, SerializedHistoryNode>; currentNodeId: string; name?: string }) => {
    const { tree: serializedTree, currentNodeId, name } = params;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const tree = deserializeTree(serializedTree);
      // Fallback workspace name from the root node of the tree
      const rootNode = tree["0"] || Object.values(tree)[0];
      const fallbackName = rootNode ? equationToString(rootNode.equation) : "Shared Workspace";
      const tabName = name || fallbackName;

      // Share-link arrival dedupe (#299): if this exact workspace (same name +
      // derivation tree, by content hash) is already saved, open the existing
      // one instead of creating a duplicate tab. `tabName` is hashed because that
      // is the name a freshly-created session would store, so it matches.
      const candidateHash = hashWorkspace({ name: tabName, currentNodeId, tree: serializedTree });
      const match = get(savedSessionsAtom).find(s => hashWorkspace(s) === candidateHash);
      if (match) {
        set(loadSessionAtom, match.id);
        set(toastAtom, { message: "You already have this workspace — opened it.", key: Date.now() });
        return { matched: true };
      }

      const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTab: WorkspaceTab = {
        id: newTabId,
        name: tabName,
        historyTree: tree,
        currentNodeId: currentNodeId,
        sessionId: newId,
        timestamp: Date.now()
      };

      const prevTabs = get(tabsAtom);
      const isOnlyDefaultTab = prevTabs.length === 1 && prevTabs[0].id === 'tab_initial' && !prevTabs[0].isModified;
      if (isOnlyDefaultTab) {
        set(tabsAtom, [newTab]);
      } else {
        set(tabsAtom, [...prevTabs, newTab]);
      }
      set(activeTabIdAtom, newTabId);

      set(currentSessionIdAtom, newId);
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
      set(hoverReduceIndexAtom, null);
      set(hoveredLoopTargetIdAtom, null);

      // Show transient status toast message
      set(toastAtom, { message: "Opened shared workspace", key: Date.now() });

      // Add to saved sessions list immediately
      const sessions = get(savedSessionsAtom);
      const newSession: SavedSession = {
        id: newId,
        name: tabName,
        timestamp: Date.now(),
        tree: serializedTree,
        currentNodeId: currentNodeId,
      };
      const updatedSessions = [newSession, ...sessions];
      set(savedSessionsAtom, updatedSessions);

      try {
        safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned(updatedSessions)));
        safeLocalStorage.setItem('algebranch_current_session_id', newId);
      } catch (err) {
        console.error('Failed to save sessions to localStorage:', err);
      }
      return { matched: false };
    } catch (err) {
      console.error('Failed to load shared session:', err);
      return { matched: false };
    }
  }
);

/**
 * Action: Load a specific session by ID.
 */
export const loadSessionAtom = atom(
  null,
  (get, set, sessionId: string) => {
    const sessions = get(savedSessionsAtom);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Loading from the library is an explicit "give me this equation" action, so
    // move keyboard/screen-reader focus to the first term (#231) — whether it
    // opens a new tab or reactivates one already open. (This is distinct from
    // clicking the tab strip, which is a separate path we leave alone.)
    set(requestTreeRefocusAtom);

    // Check if a tab with this sessionId is already open
    const prevTabs = get(tabsAtom);
    const existingTab = prevTabs.find(t => t.sessionId === sessionId);
    if (existingTab) {
      set(activeTabIdAtom, existingTab.id);
      set(currentSessionIdAtom, sessionId);
      return;
    }

    try {
      const deserialized = deserializeTree(session.tree);
      
      // Create a brand new workspace tab for this session and select it
      const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fallbackTimestamp = getSessionLatestTimestamp(deserialized);
      const newTab: WorkspaceTab = {
        id: newTabId,
        name: session.name,
        historyTree: deserialized,
        currentNodeId: session.currentNodeId,
        sessionId: sessionId,
        timestamp: session.timestamp || fallbackTimestamp
      };

      set(tabsAtom, [...prevTabs, newTab]);
      set(activeTabIdAtom, newTabId);

      set(currentSessionIdAtom, sessionId);
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
      set(hoverReduceIndexAtom, null);
      set(hoveredLoopTargetIdAtom, null);

      // Show transient status toast message
      set(toastAtom, { message: "Loaded workspace session", key: Date.now() });

      try {
        safeLocalStorage.setItem('algebranch_current_session_id', sessionId);
      } catch (err) {
        console.error('Failed to save active session ID:', err);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }
);

/**
 * Action: Merge imported workspaces (#203) into the saved-session library and
 * persist. Returns how many were added vs. skipped (content already present) so
 * the Import modal can report the outcome. Dedupe / id-collision rules live in
 * the pure `mergeWorkspaces` helper.
 */
export const importWorkspacesAtom = atom(
  null,
  (get, set, incoming: ExportedWorkspace[]): { added: number; skipped: number } => {
    const existing = get(savedSessionsAtom);
    const { merged, skipped } = mergeWorkspaces(existing, incoming);
    set(savedSessionsAtom, merged);
    try {
      safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned(merged)));
    } catch (err) {
      console.error('Failed to persist imported sessions:', err);
    }
    return { added: merged.length - existing.length, skipped };
  }
);

/**
 * Action: Delete a specific session by ID.
 */
export const deleteSessionAtom = atom(
  null,
  (get, set, sessionId: string) => {
    const sessions = get(savedSessionsAtom);
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    set(savedSessionsAtom, updatedSessions);

    // Save updated sessions to localStorage immediately
    try {
      safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned(updatedSessions)));
    } catch (err) {
      console.error('Failed to save sessions after deletion:', err);
    }

    // Find the tab associated with this session and close/remove it
    const tabs = get(tabsAtom);
    const tabToDelete = tabs.find(t => t.sessionId === sessionId);
    if (tabToDelete) {
      const filteredTabs = tabs.filter(t => t.id !== tabToDelete.id);
      if (filteredTabs.length > 0) {
        set(tabsAtom, filteredTabs);
        
        // If we are deleting the active tab, we need to switch activeTabId
        const activeId = get(activeTabIdAtom);
        if (activeId === tabToDelete.id) {
          const closedIndex = tabs.findIndex(t => t.id === tabToDelete.id);
          const nextActiveIndex = Math.min(closedIndex, filteredTabs.length - 1);
          set(activeTabIdAtom, filteredTabs[nextActiveIndex].id);
        }
      } else {
        // If no tabs left, reset to fallback tab
        set(tabsAtom, getFallbackTabs());
        set(activeTabIdAtom, 'tab_initial');
      }
    }

    const currentSessionId = get(currentSessionIdAtom);
    if (currentSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        // Load the most recent session
        const nextSession = updatedSessions[0];
        set(loadSessionAtom, nextSession.id);
      } else {
        // Create a new blank session
        set(createNewSessionAtom);
      }
    }
  }
);

/**
 * Resets the entire store to a new starting equation string.
 */
export const resetToEquationStringAtom = atom(
  null,
  (_get, set, eqStr: string, customName?: string) => {
    set(createNewSessionAtom, eqStr, customName);
    // Loading an equation from the library or the input modal is an explicit
    // "give me this equation" action, so move keyboard/screen-reader focus to
    // its first term (#231). Only this explicit-reset wrapper bumps the nonce —
    // createNewSessionAtom is also used for the passive initial mount, which
    // must not steal focus on first paint.
    set(requestTreeRefocusAtom);
  }
);

/**
 * The prefill payload for the equation input dialog when it is opened in "edit"
 * mode (#261). `null` means the dialog opens blank for a brand-new equation.
 */
export interface EquationEditSeed {
  lhs: string;
  relation: RelationOperator;
  rhs: string;
  title?: string;
}

/**
 * Splits an equation into the LHS / relation / RHS strings the input dialog
 * needs to prefill its two sides. Reuses `equationToString` (which joins the
 * sides with ` ${relation} `) and splits back on that exact separator, so the
 * side strings round-trip through the same formatter the rest of the app uses.
 */
const toEquationEditSeed = (eq: Equation, title?: string): EquationEditSeed => {
  const relation = (eq.relation ?? '=') as RelationOperator;
  const full = equationToString(eq);
  const sep = ` ${relation} `;
  const idx = full.indexOf(sep);
  const base = idx === -1
    ? { lhs: full.trim(), relation, rhs: '' }
    : { lhs: full.slice(0, idx), relation, rhs: full.slice(idx + sep.length) };
  return { ...base, title };
};

/**
 * Splits a potentially malformed raw string into LHS / relation / RHS.
 * Useful when receiving a broken equation from a query parameter to prefill
 * the input modal in edit mode so the user can fix it.
 */
export const parseRawStringToEditSeed = (rawStr: string): EquationEditSeed => {
  const ops: RelationOperator[] = ['<=', '>=', '=', '<', '>'];
  let firstOp: RelationOperator | null = null;
  let firstIdx = -1;

  for (const op of ops) {
    const idx = rawStr.indexOf(op);
    if (idx !== -1) {
      if (firstIdx === -1 || idx < firstIdx) {
        firstIdx = idx;
        firstOp = op;
      }
    }
  }

  if (firstIdx === -1 || !firstOp) {
    return {
      lhs: rawStr.trim(),
      relation: '=',
      rhs: '',
    };
  }

  return {
    lhs: rawStr.slice(0, firstIdx).trim(),
    relation: firstOp,
    rhs: rawStr.slice(firstIdx + firstOp.length).trim(),
  };
};

/**
 * Atom: the edit-mode seed for the input dialog. Set by `openEquationEditorAtom`
 * and cleared by the dialog on close so a stale seed never leaks into a later
 * blank ("new equation") open.
 */
export const equationEditSeedAtom = atom<EquationEditSeed | null>(null);

/**
 * Action: open the input dialog in edit mode, prefilled from the equation at the
 * CURRENT node (#261). Navigating the tree then editing is how you "fork from a
 * node" without spending per-node UI space.
 */
export const openEquationEditorAtom = atom(null, (get, set) => {
  const eq = get(currentEquationAtom);
  if (!eq) return;
  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  const activeTab = tabs.find(t => t.id === activeId);
  const title = activeTab && activeTab.isCustomNamed ? activeTab.name : undefined;
  set(equationEditSeedAtom, toEquationEditSeed(eq, title));
  set(equationInputModalOpenAtom, true);
});

/**
 * Read-only: is the active workspace "pristine" — a single root node with no
 * derivation steps taken yet? Drives the adaptive Edit tooltip and the
 * in-place-vs-fork branch in `submitEquationEditAtom` (#261).
 */
export const activeWorkspacePristineAtom = atom<boolean>((get) => {
  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
  if (!activeTab) return true;
  return Object.keys(activeTab.historyTree).length === 1;
});

/**
 * Action: commit an edited equation from the input dialog (#261).
 *
 * Editing an equation starts a new derivation by definition — history cannot
 * survive a change to the equation it descends from. So:
 *  - Pristine workspace (no steps yet) → replace the root equation in place;
 *    there is nothing to invalidate.
 *  - Workspace with history → fork a fresh single-node workspace from the edited
 *    equation, leaving the original derivation completely untouched.
 *
 * Parses up front so an invalid equation throws BEFORE any state is mutated; the
 * dialog catches the throw and surfaces it as a submit error.
 */
export const submitEquationEditAtom = atom(null, (get, set, eqStr: string, customName?: string) => {
  const newEq = ensureNodeIds(parseEquation(eqStr));

  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
  const isPristine = !!activeTab && Object.keys(activeTab.historyTree).length === 1;

  if (isPristine && activeTab) {
    const updatedTabs = tabs.map(t => {
      if (t.id !== activeTab.id) return t;
      const isDefaultPlaceholder = t.id === DEFAULT_TAB_ID && t.name === DEFAULT_TAB_NAME;
      const isCustomNamed = customName !== undefined ? !!customName.trim() : (!!t.isCustomNamed && !isDefaultPlaceholder);
      const tabName = customName !== undefined && customName.trim() !== '' ? customName.trim() : (isCustomNamed ? t.name : eqStr);
      return {
        ...t,
        historyTree: {
          '0': {
            id: '0',
            equation: newEq,
            parentId: null,
            childrenIds: [],
            label: 'Initial',
            timestamp: Date.now(),
          },
        },
        currentNodeId: '0',
        name: tabName,
        isCustomNamed,
        isModified: true,
        timestamp: Date.now(),
      };
    });
    set(tabsAtom, updatedTabs);

    // Clear intermediate interaction state, mirroring createNewSessionAtom.
    set(sourcePathAtom, null);
    set(hoverPathAtom, null);
    set(hoverReducePathAtom, null);
    set(hoverReduceIndexAtom, null);
    set(hoveredLoopTargetIdAtom, null);

    set(toastAtom, { message: 'Equation updated', key: Date.now() });
  } else {
    // createNewSessionAtom appends a new tab and makes it active; its own
    // "Created new workspace" toast is replaced below with edit-specific copy.
    set(createNewSessionAtom, eqStr, customName);
    set(toastAtom, { message: 'Edited copy opened in a new workspace; original kept', key: Date.now() });
  }

  set(requestTreeRefocusAtom);
});

/**
 * Action: Toggles the sign of a square root at the specified path (+/-).
 */
export const toggleRootSignAtom = atom(
  null,
  (get, set, path: string) => {
    const currentEq = get(currentEquationAtom);
    if (!currentEq) return;

    try {
      const targetNode = getNodeByPath(currentEq, path);
      let nextNode: math.MathNode;

      if (
        targetNode.type === 'OperatorNode' &&
        (targetNode as math.OperatorNode).op === '-' &&
        (targetNode as math.OperatorNode).isUnary()
      ) {
        nextNode = (targetNode as math.OperatorNode).args[0];
      } else {
        nextNode = new mjs.OperatorNode('-', 'subtract', [targetNode]);
      }

      const nextEq = replaceNodeAtPath(currentEq, path, nextNode);
      set(pushEquationAtom, nextEq, "Root ±");
    } catch (err) {
      console.error('Failed to toggle root sign in store action:', err);
    }
  }
);

/**
 * Action: Applies an algebraic operation to both sides of the active equation simultaneously.
 */
export const applyGlobalOpAtom = atom(
  null,
  (get, set, params: GlobalOpParams) => {
    const currentEq = get(currentEquationAtom);
    if (!currentEq) return;

    // AST mutation lives in the (single) math engine; the store only orchestrates
    // history + the display label. Throws on a binary op with no term.
    const nextEq = applyGlobalOp(currentEq, params);

    const { type, term, power } = params;
    const effectivePower = power ?? 2;
    let label: string;
    if (type === 'square' || type === 'power') {
      label = effectivePower === 2 ? 'Global Sq' : `Global Power ${effectivePower}`;
    } else if (type === 'sqrt' || type === 'root') {
      label = effectivePower === 2 ? 'Global Sqrt' : `Global ${effectivePower}-Root`;
    } else {
      const sym = type === 'add' ? '+' : type === 'sub' ? '-' : type === 'mul' ? MULTIPLY_SYMBOL : '÷';
      label = `Global ${sym} ${term?.trim() ?? ''}`;
    }

    set(pushEquationAtom, nextEq, label, describeGlobalOp(params));
  }
);

/**
 * Action: Swaps the left-hand side and right-hand side of the current equation.
 * e.g. `a = b` becomes `b = a`
 */
export const swapSidesAtom = atom(
  null,
  (get, set) => {
    const currentEq = get(currentEquationAtom);
    if (!currentEq) return;

    // Swapping the sides reverses the relation's direction (e.g. `x < 5` -> `5 > x`).
    const nextEq: Equation = { lhs: currentEq.rhs, rhs: currentEq.lhs, relation: flipRelation(currentEq.relation) };
    set(pushEquationAtom, nextEq, 'Swap Sides');
  }
);

/**
 * Action: Atomically synchronizes the server-side math state (candidate, reducible, and target paths)
 * by deserializing their serialized AST objects back into mathjs Equation trees.
 */
export const syncMathStateAtom = atom(
  null,
  (_get, set, { activePaths, reduciblePaths, targetPaths }: { 
    activePaths: string[]; 
    reduciblePaths: Record<string, { equation: SerializedEquation; type: 'reduce' | 'distribute' | 'identity'; label?: string }[]>; 
    targetPaths: Record<string, SerializedEquation> 
  }) => {
    set(candidatePathsAtom, new Set<string>(activePaths));

    const parsedReducible: Record<string, ReducibleActionInfo[]> = {};
    Object.keys(reduciblePaths).forEach((k) => {
      parsedReducible[k] = reduciblePaths[k].map(item => ({
        equation: deserializeEquation(item.equation),
        type: item.type,
        label: item.label
      }));
    });
    set(reduciblePathsAtom, parsedReducible);

    const parsedTargets: Record<string, Equation> = {};
    Object.keys(targetPaths).forEach((k) => {
      parsedTargets[k] = deserializeEquation(targetPaths[k]);
    });
    set(targetPathsAtom, parsedTargets);
  }
);

/**
 * Action: Clears the server-side math state to avoid stale highlights/actions rendering during transitions.
 */
export const clearMathStateAtom = atom(
  null,
  (_get, set) => {
    set(candidatePathsAtom, new Set<string>());
    set(reduciblePathsAtom, {});
    set(targetPathsAtom, {});
  }
);

/**
 * Atom: Tracks whether the backend math engine API is currently executing calculations.
 */
export const mathLoadingAtom = atom(false);

/**
 * Atom: True while the equation tree is mid-slide (FLIP move animation, #234).
 * Driven by `useFLIPAnimation`; nodes read it to suppress hover tooltips that
 * would otherwise pop up under the cursor while a term is still in motion.
 */
export const isTreeAnimatingAtom = atom(false);

export interface ToastState {
  message: string;
  key: number;
  type?: 'default' | 'update';
  onAction?: () => void;
  actionLabel?: string;
  persistent?: boolean;
}

/**
 * Atom: Tracks transient status messages shown to the user.
 */
export const toastAtom = atom<ToastState | null>(null);

/**
 * Action: Add a new workspace tab.
 */
export const addTabAtom = atom(
  null,
  (get, set, initialEqStr?: string) => {
    const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      let newTab: WorkspaceTab;
      const prevTabs = get(tabsAtom);
      const activeId = get(activeTabIdAtom);
      const activeTab = prevTabs.find(t => t.id === activeId) || prevTabs[0];

      if (!initialEqStr && activeTab) {
        // Clone the active tab's historyTree and current location to allow branching
        const clonedHistoryTree: Record<string, HistoryNode> = {};
        Object.keys(activeTab.historyTree).forEach(id => {
          const node = activeTab.historyTree[id];
          clonedHistoryTree[id] = {
            ...node,
            equation: {
              lhs: node.equation.lhs.clone(),
              rhs: node.equation.rhs.clone()
            },
            childrenIds: [...node.childrenIds]
          };
        });

        // Generate a unique cloned tab name to avoid duplicate names
        let baseName = activeTab.name;
        const copyMatch = activeTab.name.match(/^(.*?)\s*\(Copy\s*(\d*)\)$/);
        if (copyMatch) {
          baseName = copyMatch[1];
        }
        
        let suffixNum = 1;
        let candidateName = copyMatch ? `${baseName} (Copy ${parseInt(copyMatch[2] || '1') + 1})` : `${baseName} (Copy)`;
        
        const existingNames = prevTabs.map(t => t.name);
        while (existingNames.includes(candidateName)) {
          suffixNum++;
          candidateName = `${baseName} (Copy ${suffixNum})`;
        }

        newTab = {
          id: newTabId,
          name: candidateName,
          historyTree: clonedHistoryTree,
          currentNodeId: activeTab.currentNodeId,
          isCustomNamed: activeTab.isCustomNamed,
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now()
        };

        // Show transient success message
        set(toastAtom, { message: "Cloned active workspace", key: Date.now() });
      } else {
        // Create a brand new workspace with the given equation or fallback
        const eqStr = initialEqStr || INITIAL_EQUATION_STRING;
        const newEq = ensureNodeIds(parseEquation(eqStr));
        newTab = {
          id: newTabId,
          name: eqStr,
          historyTree: {
            "0": {
              id: "0",
              equation: newEq,
              parentId: null,
              childrenIds: [],
              label: "Initial",
              timestamp: Date.now(),
            }
          },
          currentNodeId: "0",
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now()
        };
      }

      set(tabsAtom, [...prevTabs, newTab]);
      set(activeTabIdAtom, newTabId);
      
      // Clear intermediate states
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
      set(hoverReduceIndexAtom, null);
      set(hoveredLoopTargetIdAtom, null);
    } catch (err) {
      console.error('Failed to add tab:', err);
    }
  }
);

/**
 * Action: Close a workspace tab.
 */
export const closeTabAtom = atom(
  null,
  (get, set, tabId: string) => {
    const tabs = get(tabsAtom);
    if (tabs.length <= 1) {
      // If closing the last tab, reset it rather than deleting it
      set(tabsAtom, [
        {
          id: 'tab_initial',
          name: 'Sample Workspace',
          historyTree: {
            "0": {
              id: "0",
              equation: parseEquation(INITIAL_EQUATION_STRING),
              parentId: null,
              childrenIds: [],
              label: "Initial",
              timestamp: Date.now(),
            }
          },
          currentNodeId: "0",
          isCustomNamed: true,
          sessionId: 'session_initial',
          timestamp: Date.now()
        }
      ]);
      set(activeTabIdAtom, 'tab_initial');
      return;
    }

    const filtered = tabs.filter(t => t.id !== tabId);
    set(tabsAtom, filtered);

    const activeId = get(activeTabIdAtom);
    if (activeId === tabId) {
      // Switch active tab to the adjacent tab
      const closedIndex = tabs.findIndex(t => t.id === tabId);
      const nextActiveIndex = Math.min(closedIndex, filtered.length - 1);
      set(activeTabIdAtom, filtered[nextActiveIndex].id);
    }
    
    // Clear intermediate states
    set(sourcePathAtom, null);
    set(hoverPathAtom, null);
    set(hoverReducePathAtom, null);
    set(hoverReduceIndexAtom, null);
    set(hoveredLoopTargetIdAtom, null);
  }
);

/**
 * Action: Switch the active workspace tab by a relative offset, wrapping around
 * the ends. `+1` selects the next tab, `-1` the previous. No-op with one tab.
 */
export const cycleActiveTabAtom = atom(
  null,
  (get, set, delta: number) => {
    const tabs = get(tabsAtom);
    if (tabs.length <= 1) return;
    const activeId = get(activeTabIdAtom);
    const currentIndex = tabs.findIndex(t => t.id === activeId);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (safeIndex + delta + tabs.length) % tabs.length;
    set(activeTabIdAtom, tabs[nextIndex].id);
  }
);

/**
 * Action: Rename a workspace tab.
 */
export const renameTabAtom = atom(
  null,
  (get, set, { tabId, name }: { tabId: string; name: string }) => {
    const tabs = get(tabsAtom);
    const updated = tabs.map(t => {
      if (t.id === tabId) {
        return { 
          ...t, 
          name: name.trim(),
          isCustomNamed: true,
          isModified: true,
          timestamp: Date.now()
        };
      }
      return t;
    });
    set(tabsAtom, updated);
  }
);

/**
 * Action: Hydrates workspace tabs from localStorage on client-side mount.
 */
export const hydrateWorkspaceTabsAtom = atom(
  null,
  (get, set) => {
    if (typeof window === 'undefined') return;
    try {
      const savedGraphSize = safeLocalStorage.getItem('algebranch_graph_size');
      if (savedGraphSize === 'hidden' || savedGraphSize === 'split' || savedGraphSize === 'expand') {
        set(rawGraphSizeAtom, savedGraphSize);
      }

      const savedSettings = safeLocalStorage.getItem('algebranch_settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          const merged = { ...DEFAULT_SETTINGS, ...parsed };
          // Sanitize the text-size knob: persisted/hand-edited junk must never
          // drive the root rem to an unusable extreme (#239).
          merged.chromeScale = clampChromeScale(merged.chromeScale);
          set(rawSettingsAtom, merged);
        } catch (err) {
          console.error('Failed to parse settings from localStorage:', err);
        }
      }

      const savedTabs = safeLocalStorage.getItem('algebranch_workspace_tabs');
      const savedActiveId = safeLocalStorage.getItem('algebranch_active_tab_id');
      
      if (savedTabs) {
        const payload = unwrapVersioned<Array<Omit<WorkspaceTab, 'historyTree'> & { historyTree: Record<string, SerializedHistoryNode> }>>(savedTabs);
        if (payload) {
          const deserialized = payload.map((tab) => {
            const tree = deserializeTree(tab.historyTree);
            return {
              ...tab,
              historyTree: tree,
              sessionId: tab.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: tab.timestamp || getSessionLatestTimestamp(tree)
            };
          });
          set(rawTabsAtom, deserialized);

          const activeId = savedActiveId || 'tab_initial';
          const activeTab = deserialized.find((t) => t.id === activeId) || deserialized[0];
          if (activeTab?.sessionId) {
            set(rawCurrentSessionIdAtom, activeTab.sessionId);
          }
        }
      }
      
      if (savedActiveId) {
        set(rawActiveTabIdAtom, savedActiveId);
      }

      const onboardingCompleted = safeLocalStorage.getItem('algebranch_onboarding_completed') === 'true';
      set(onboardingCompletedAtom, onboardingCompleted);
    } catch (err) {
      console.error('Failed to hydrate workspace tabs from localStorage:', err);
    }
  }
);


// ==========================================
// Onboarding Tour State Atoms
// (chapter content lives in constants/onboarding.ts; re-exported for consumers)
// ==========================================

export { ONBOARDING_CHAPTERS };
export type { OnboardingStep, OnboardingChapter } from '../constants/onboarding';

export const onboardingChapterIdAtom = atom<string | null>(null);
export const onboardingStepIndexAtom = atom<number | null>(null);
export const onboardingHighlightPathAtom = atom<string | null>(null);
export const onboardingShowDirectoryAtom = atom<boolean>(false);
export const onboardingCompletedAtom = atom<boolean>(false);

// Onboarding step progress is stored PER CHAPTER (chapterId -> stepIndex) so
// starting/resuming one chapter never clobbers another chapter's saved step.
// `algebranch_onboarding_chapter_id` remains a single "currently active chapter"
// pointer used only for auto-resume on reload.
export const ONBOARDING_STEPS_KEY = 'algebranch_onboarding_steps';

export const readOnboardingSteps = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = safeLocalStorage.getItem(ONBOARDING_STEPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeOnboardingStep = (chapterId: string, stepIndex: number) => {
  if (typeof window === 'undefined') return;
  const map = readOnboardingSteps();
  map[chapterId] = stepIndex;
  safeLocalStorage.setItem(ONBOARDING_STEPS_KEY, JSON.stringify(map));
};

export const clearOnboardingStep = (chapterId: string) => {
  if (typeof window === 'undefined') return;
  const map = readOnboardingSteps();
  delete map[chapterId];
  safeLocalStorage.setItem(ONBOARDING_STEPS_KEY, JSON.stringify(map));
};

// Make the coach card follow the active workspace tab. Given the active tab's
// chapterId (or null for a non-tutorial tab), activate the tour view for that
// chapter at its saved step, or hide it. Never resets the tab tree or touches
// per-chapter progress — it only reflects existing state, so switching tabs is
// non-destructive and reversible.
/**
 * Parse a chapter's `facts` declarations (#3) into SubstitutionFacts presented
 * as "solved in another workspace" (provenance label: Tutorial).
 */
const chapterFacts = (chapter: { facts?: string[] } | undefined): SubstitutionFact[] => {
  const facts: SubstitutionFact[] = [];
  for (const f of chapter?.facts ?? []) {
    try {
      const def = getIsolatedDefinition(ensureNodeIds(parseEquation(f)));
      if (def) facts.push({ ...def, sourceName: 'Tutorial' });
    } catch {
      /* skip malformed chapter facts */
    }
  }
  return facts;
};

export const syncTourToActiveTabAtom = atom(
  null,
  (get, set, chapterId: string | null) => {
    const chapter = chapterId ? ONBOARDING_CHAPTERS.find(c => c.id === chapterId) : undefined;
    const stepIdx = chapter ? readOnboardingSteps()[chapter.id] : undefined;

    // Hide the coach for non-tutorial tabs and for completed / never-started
    // chapters (no in-progress step entry).
    if (!chapter || stepIdx === undefined) {
      set(onboardingChapterIdAtom, null);
      set(onboardingStepIndexAtom, null);
      set(onboardingHighlightPathAtom, null);
      set(tutorialFactsAtom, []);
      set(sourcePathAtom, null);
      if (typeof window !== 'undefined') {
        safeLocalStorage.setItem('algebranch_onboarding_active', 'false');
      }
      return;
    }

    set(onboardingChapterIdAtom, chapter.id);
    set(onboardingStepIndexAtom, stepIdx);
    set(onboardingHighlightPathAtom, chapter.steps[stepIdx]?.highlightPath || null);
    set(onboardingShowDirectoryAtom, false);
    set(tutorialFactsAtom, chapterFacts(chapter));
    set(sourcePathAtom, chapter.steps[stepIdx]?.selectPath || null);
    if (typeof window !== 'undefined') {
      safeLocalStorage.setItem('algebranch_onboarding_chapter_id', chapter.id);
      safeLocalStorage.setItem('algebranch_onboarding_active', 'true');
    }
  }
);

export const startOnboardingChapterAtom = atom(
  null,
  (get, set, chapterId: string, resumeStepIndex?: number) => {
    const chapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
    if (!chapter) return;
    
    const stepIdx = resumeStepIndex ?? 0;
    set(onboardingChapterIdAtom, chapterId);
    set(onboardingStepIndexAtom, stepIdx);
    set(onboardingHighlightPathAtom, chapter.steps[stepIdx]?.highlightPath || null);
    set(onboardingShowDirectoryAtom, false);
    set(tutorialFactsAtom, chapterFacts(chapter));

    const stepStartEq = stepIdx > 0
      ? chapter.steps[stepIdx - 1].nextEquation
      : chapter.initialEquation;

    // One workspace per chapter: reuse this chapter's existing tab/session
    // (resetting it to the chapter's start state) instead of spawning a
    // duplicate every time the tutorial is started or resumed. Visiting each
    // chapter thus bootstraps the recent-workspaces list with one recognizable,
    // explorable workspace per chapter.
    const title = `🎓 Tutorial: ${chapter.title.split('. ')[1]}`;
    try {
      const newEq = ensureNodeIds(parseEquation(stepStartEq));
      const freshTree: Record<string, HistoryNode> = {
        "0": {
          id: "0",
          equation: newEq,
          parentId: null,
          childrenIds: [],
          label: "Initial",
          timestamp: Date.now(),
        },
      };

      const prevTabs = get(tabsAtom);
      const sessions = get(savedSessionsAtom);
      const existingTab = prevTabs.find(t => t.chapterId === chapterId);
      const existingSession = sessions.find(s => s.chapterId === chapterId);
      const sessionId = existingTab?.sessionId
        || existingSession?.id
        || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Resuming mid-chapter (step > 0) into an open tab preserves the user's
      // in-progress derivation; a fresh start (step 0) or a closed tab resets to
      // the chapter's start state.
      const resuming = !!existingTab && stepIdx > 0;
      const tabTree = resuming ? existingTab!.historyTree : freshTree;
      const tabNodeId = resuming ? existingTab!.currentNodeId : "0";

      // Refresh (or create) the single saved session for this chapter, keyed by
      // a stable sessionId so the recent-workspaces list never accumulates dupes.
      const refreshedSession: SavedSession = {
        id: sessionId,
        name: title,
        chapterId,
        timestamp: Date.now(),
        tree: serializeTree(tabTree),
        currentNodeId: tabNodeId,
      };
      const updatedSessions = [refreshedSession, ...sessions.filter(s => s.id !== sessionId)];
      set(savedSessionsAtom, updatedSessions);

      if (existingTab) {
        // Reuse the open chapter tab in place (preserving progress on resume).
        set(tabsAtom, prevTabs.map(t => t.id === existingTab.id
          ? {
              ...t,
              name: title,
              historyTree: tabTree,
              currentNodeId: tabNodeId,
              isCustomNamed: true,
              isModified: resuming ? t.isModified : false,
              chapterId,
              sessionId,
              timestamp: Date.now(),
            }
          : t));
        set(activeTabIdAtom, existingTab.id);
      } else {
        const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newTab: WorkspaceTab = {
          id: newTabId,
          name: title,
          historyTree: freshTree,
          currentNodeId: "0",
          isCustomNamed: true,
          chapterId,
          sessionId,
          timestamp: Date.now(),
        };
        set(tabsAtom, [...prevTabs, newTab]);
        set(activeTabIdAtom, newTabId);
      }

      set(currentSessionIdAtom, sessionId);
      set(sourcePathAtom, null);
      set(hoverPathAtom, null);
      set(hoverReducePathAtom, null);
      set(hoverReduceIndexAtom, null);
      set(hoveredLoopTargetIdAtom, null);

      try {
        safeLocalStorage.setItem('algebranch_saved_sessions', JSON.stringify(wrapVersioned(updatedSessions)));
        safeLocalStorage.setItem('algebranch_current_session_id', sessionId);
      } catch (err) {
        console.error('Failed to save tutorial session to localStorage:', err);
      }
    } catch (err) {
      console.error('Failed to start onboarding chapter:', err);
    }

    if (typeof window !== 'undefined') {
      safeLocalStorage.setItem('algebranch_onboarding_chapter_id', chapterId);
      writeOnboardingStep(chapterId, stepIdx);
      safeLocalStorage.setItem('algebranch_onboarding_active', 'true');
    }
  }
);

export const setOnboardingStepAtom = atom(
  null,
  (get, set, nextIndex: number | null) => {
    const chapterId = get(onboardingChapterIdAtom);
    const chapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
    if (!chapter) return;

    if (nextIndex === null || nextIndex < 0 || nextIndex >= chapter.steps.length) {
      // End the onboarding tour
      const finishedChapterId = get(onboardingChapterIdAtom);
      set(onboardingChapterIdAtom, null);
      set(onboardingStepIndexAtom, null);
      set(onboardingHighlightPathAtom, null);
      set(onboardingShowDirectoryAtom, false);
      set(tutorialFactsAtom, []);
      set(sourcePathAtom, null);

      // Remove chapterId from the active tab so it behaves as a normal tab
      const activeTabId = get(activeTabIdAtom);
      if (activeTabId) {
        set(tabsAtom, (prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, chapterId: undefined } : t))
        );
      }

      if (typeof window !== 'undefined') {
        safeLocalStorage.setItem('algebranch_onboarding_active', 'false');
        safeLocalStorage.setItem('algebranch_onboarding_completed', 'true');
        set(onboardingCompletedAtom, true);

        if (nextIndex !== null && nextIndex >= chapter.steps.length) {
          safeLocalStorage.removeItem('algebranch_onboarding_chapter_id');
          safeLocalStorage.removeItem('algebranch_onboarding_active');
          if (finishedChapterId) clearOnboardingStep(finishedChapterId);

          if (finishedChapterId) {
            try {
              const completed = safeLocalStorage.getItem('algebranch_completed_chapters');
              const list: string[] = completed ? JSON.parse(completed) : [];
              if (!list.includes(finishedChapterId)) {
                list.push(finishedChapterId);
                safeLocalStorage.setItem('algebranch_completed_chapters', JSON.stringify(list));
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
      return;
    }

    const currentStepIndex = get(onboardingStepIndexAtom);
    const currentEq = get(currentEquationAtom);
    
    // Advancing past an action step the user hasn't performed themselves:
    // perform it for them, preferring the same live mechanisms a real click
    // uses (synced target slots / reduce handles) so FLIP animations and
    // history labels match a manual derivation. Falls back to parsing the
    // expected equation when no live action produces it.
    if (currentStepIndex !== null && nextIndex > currentStepIndex) {
      const prevStep = chapter.steps[currentStepIndex];
      if (prevStep.nextEquation && currentEq) {
        const stripEq = (eq: Equation) => equationToString(eq).replace(/\s+/g, '');
        const currentStr = stripEq(currentEq);
        const targetStr = prevStep.nextEquation.replace(/\s+/g, '');

        if (currentStr !== targetStr) {
          // 1. Live transposition: a synced target slot already yields the expected equation
          const targetResult = Object.values(get(targetPathsAtom)).find(eq => stripEq(eq) === targetStr);
          // 2. Live reduction: a simplify/distribute handle yields the expected equation
          const reduceAction = !targetResult
            ? Object.values(get(filteredReduciblePathsAtom)).flat().find(a => stripEq(a.equation) === targetStr)
            : undefined;
          // 2.5 Live substitution: a fact-based option yields the expected equation (#3)
          const subOption = !targetResult && !reduceAction
            ? Object.values(get(substitutionPathsAtom)).flat().find(o => stripEq(o.substituted) === targetStr)
            : undefined;

          if (targetResult) {
            set(pushEquationAtom, targetResult, prevStep.stepLabel || 'Move');
          } else if (reduceAction) {
            set(pushEquationAtom, reduceAction.equation, reduceAction.label || prevStep.stepLabel || 'Simplify');
          } else if (subOption) {
            set(pushEquationAtom, subOption.substituted, 'Substitute', describeSubstitution(subOption.variable, subOption.replacement));
          } else if (prevStep.globalOp) {
            // 3. Global operation applied to both sides
            set(applyGlobalOpAtom, prevStep.globalOp);
          } else {
            // 4. Fallback: push the parsed expected equation directly
            const parsed = parseEquation(prevStep.nextEquation);
            set(pushEquationAtom, parsed, prevStep.stepLabel || 'Step');
          }
        }
      }
    }
    // If going back, only move to parent if equation doesn't already match the previous step's nextEquation
    else if (currentStepIndex !== null && nextIndex < currentStepIndex) {
      const prevStep = nextIndex > 0 ? chapter.steps[nextIndex - 1] : null;
      const targetEqStr = prevStep ? prevStep.nextEquation : chapter.initialEquation;
      
      if (targetEqStr && currentEq) {
        const currentStr = equationToString(currentEq).replace(/\s+/g, '');
        const targetStr = targetEqStr.replace(/\s+/g, '');
        
        if (currentStr !== targetStr) {
          const tree = get(historyTreeAtom);
          const nodeId = get(currentNodeIdAtom);
          const activeNode = tree[nodeId];
          if (activeNode?.parentId) {
            set(currentNodeIdAtom, activeNode.parentId);
          }
        }
      }
    }

    set(onboardingStepIndexAtom, nextIndex);
    set(onboardingHighlightPathAtom, chapter.steps[nextIndex].highlightPath);

    // Save current step to localStorage (per chapter) so other chapters keep theirs.
    if (typeof window !== 'undefined' && chapterId) {
      safeLocalStorage.setItem('algebranch_onboarding_chapter_id', chapterId);
      writeOnboardingStep(chapterId, nextIndex);
      safeLocalStorage.setItem('algebranch_onboarding_active', 'true');
    }

    // Update selection based on next step's selectPath
    const nextStep = chapter.steps[nextIndex];
    if (nextStep && nextStep.selectPath) {
      set(sourcePathAtom, nextStep.selectPath);
    } else {
      set(sourcePathAtom, null);
    }
  }
);

/**
 * The target slot the tutorial wants clicked next: the synced target path whose
 * resulting equation matches the active step's expected nextEquation. Null when
 * no source is selected (targetPathsAtom empty) or no slot produces the result.
 */
export const onboardingTargetPathAtom = atom<string | null>((get) => {
  const chapterId = get(onboardingChapterIdAtom);
  const stepIndex = get(onboardingStepIndexAtom);
  if (!chapterId || stepIndex === null) return null;

  const chapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
  const step = chapter?.steps[stepIndex];
  if (!step || !step.nextEquation) return null;

  const targetStr = step.nextEquation.replace(/\s+/g, '');
  for (const [path, eq] of Object.entries(get(targetPathsAtom))) {
    if (equationToString(eq).replace(/\s+/g, '') === targetStr) return path;
  }
  return null;
});

/**
 * The reduce handle the tutorial wants clicked next: the synced reducible action
 * whose resulting equation matches the active step's expected nextEquation.
 * When set, the annotation circle marks this handle instead of the node box.
 */
export const onboardingReduceHandleAtom = atom<{ path: string; index: number } | null>((get) => {
  const chapterId = get(onboardingChapterIdAtom);
  const stepIndex = get(onboardingStepIndexAtom);
  if (!chapterId || stepIndex === null) return null;

  const chapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
  const step = chapter?.steps[stepIndex];
  if (!step || !step.nextEquation) return null;

  const targetStr = step.nextEquation.replace(/\s+/g, '');
  for (const [path, actions] of Object.entries(get(filteredReduciblePathsAtom))) {
    const index = actions.findIndex(a => equationToString(a.equation).replace(/\s+/g, '') === targetStr);
    if (index !== -1) return { path, index };
  }
  return null;
});

/**
 * The substitution handle the tutorial wants clicked next (#3): the fact-based
 * option whose resulting equation matches the active step's expected
 * nextEquation. Mirrors onboardingReduceHandleAtom; when set, the annotation
 * circle marks the teal handle and all other interactions stay locked.
 */
export const onboardingSubstitutionAtom = atom<{ path: string; index: number } | null>((get) => {
  const chapterId = get(onboardingChapterIdAtom);
  const stepIndex = get(onboardingStepIndexAtom);
  if (!chapterId || stepIndex === null) return null;

  const chapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
  const step = chapter?.steps[stepIndex];
  if (!step || !step.nextEquation) return null;

  const targetStr = step.nextEquation.replace(/\s+/g, '');
  for (const [path, options] of Object.entries(get(substitutionPathsAtom))) {
    const index = options.findIndex(o => equationToString(o.substituted).replace(/\s+/g, '') === targetStr);
    if (index !== -1) return { path, index };
  }
  return null;
});

/**
 * The active step's global operation, if any. During the tour the equals sign
 * (global-ops radial menu) is locked except on steps that teach a global op,
 * where it carries the annotation circle instead.
 */
export const onboardingGlobalOpAtom = atom((get) => {
  const chapterId = get(onboardingChapterIdAtom);
  const stepIndex = get(onboardingStepIndexAtom);
  if (!chapterId || stepIndex === null) return null;

  const chapter = ONBOARDING_CHAPTERS.find(c => c.id === chapterId);
  return chapter?.steps[stepIndex]?.globalOp ?? null;
});
