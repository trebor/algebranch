// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Pure helpers for exporting workspaces to / importing them from a JSON file
// (#203). Kept free of React/store/engine runtime imports so they can be
// unit-tested directly; `SavedSession`/`SerializedHistoryNode` come in as
// type-only imports (erased at runtime), so this module never pulls the store.
import type { SavedSession, SerializedHistoryNode } from '../store/equation';
// Type-only (erased at runtime), so this stays free of the engine at runtime;
// imported from `math-engine` rather than the ui-only `math-engine-client` alias
// so the cross-workspace jest test (math-engine/tests) can resolve it too (#344).
import type { SerializedEquation, SerializedNode } from 'math-engine';

/** Marker so a file is unambiguously an Algebranch workspace export. */
export const WORKSPACE_FILE_APP = 'algebranch';
/** Current on-disk schema version. Bump only on a breaking format change. */
export const WORKSPACE_FILE_VERSION = 1;

/**
 * A single workspace as written to / read from the export file. Mirrors the
 * durable part of `SavedSession` minus app-managed fields: `chapterId` (tutorial
 * sessions are not exportable) is dropped entirely.
 */
export interface ExportedWorkspace {
  id: string;
  name: string;
  timestamp: number;
  tree: Record<string, SerializedHistoryNode>;
  currentNodeId: string;
}

/** Top-level shape of an `algebranch-workspaces-*.json` file. */
export interface WorkspacesFile {
  app: string;
  version: number;
  exportedAt: string;
  workspaces: ExportedWorkspace[];
}

/** A session belongs to onboarding (and is therefore not exportable). */
const isChapterSession = (s: SavedSession): boolean => !!s.chapterId;

/**
 * Serialize the given saved sessions into the pretty-printed JSON payload that
 * the Export modal downloads. Tutorial/onboarding sessions (those carrying a
 * `chapterId`) are filtered out, and `chapterId` is omitted from every entry.
 */
export const serializeWorkspacesToJson = (sessions: SavedSession[]): string => {
  const workspaces: ExportedWorkspace[] = sessions
    .filter(s => !isChapterSession(s))
    .map(({ id, name, timestamp, tree, currentNodeId }) => ({
      id,
      name,
      timestamp,
      tree,
      currentNodeId,
    }));

  const file: WorkspacesFile = {
    app: WORKSPACE_FILE_APP,
    version: WORKSPACE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    workspaces,
  };
  return JSON.stringify(file, null, 2);
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Parse + validate the text of an import file, returning the typed payload.
 * Throws an `Error` with a human-readable message on any problem so the Import
 * modal can surface it directly (foreign JSON, version mismatch, malformed
 * entries).
 */
export const parseWorkspacesJson = (text: string): WorkspacesFile => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (!isPlainObject(data)) {
    throw new Error('This file is not a recognized Algebranch workspace file.');
  }

  if (data.app !== WORKSPACE_FILE_APP) {
    throw new Error('This file is not an Algebranch workspace export.');
  }

  if (data.version !== WORKSPACE_FILE_VERSION) {
    throw new Error(
      `Unsupported file version ${String(data.version)}. This app reads version ${WORKSPACE_FILE_VERSION}.`,
    );
  }

  if (!Array.isArray(data.workspaces)) {
    throw new Error('This workspace file is malformed: "workspaces" is missing or not a list.');
  }

  const workspaces: ExportedWorkspace[] = data.workspaces.map((w, i) => {
    if (
      !isPlainObject(w) ||
      typeof w.id !== 'string' ||
      typeof w.name !== 'string' ||
      typeof w.currentNodeId !== 'string' ||
      !isPlainObject(w.tree)
    ) {
      throw new Error(`Workspace #${i + 1} in this file is malformed or incomplete.`);
    }
    return {
      id: w.id,
      name: w.name,
      timestamp: typeof w.timestamp === 'number' ? w.timestamp : Date.now(),
      tree: w.tree as Record<string, SerializedHistoryNode>,
      currentNodeId: w.currentNodeId,
    };
  });

  return {
    app: WORKSPACE_FILE_APP,
    version: WORKSPACE_FILE_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    workspaces,
  };
};

/**
 * Recursively re-serialize a value with object keys sorted, so structurally
 * identical objects produce byte-identical strings regardless of key insertion
 * order. Arrays keep their order (it's meaningful, e.g. `childrenIds`).
 */
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return value;
};

/** Non-cryptographic djb2 string hash. Used only for content equality grouping. */
const djb2 = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // >>> 0 → unsigned 32-bit, then base-36 for a compact stable token.
  return (hash >>> 0).toString(36);
};

/**
 * Strip every `id` off a serialized AST node (#344). Node ids are volatile
 * identity fields — since the persisted format now carries them, the content
 * hash must ignore them so the same equation hashes equally whether its ids were
 * assigned fresh (`ensureNodeIds`) or carried forward from a share link.
 */
const stripNodeIds = (node: SerializedNode): SerializedNode => {
  const stripped: SerializedNode = { ...node };
  delete stripped.id;
  if (node.args) stripped.args = node.args.map(stripNodeIds);
  if (node.content) stripped.content = stripNodeIds(node.content);
  return stripped;
};

/** Canonical, id-free form of a node's equation for hashing; legacy strings pass through. */
const canonicalEquation = (eq: SerializedEquation | string): SerializedEquation | string =>
  typeof eq === 'string'
    ? eq
    : { lhs: stripNodeIds(eq.lhs), rhs: stripNodeIds(eq.rhs), ...(eq.relation ? { relation: eq.relation } : {}) };

/**
 * Content hash of a workspace, ignoring volatile identity fields (`id`,
 * `timestamp`, and per-node AST ids) and node-key ordering. Two workspaces with
 * the same name and the same derivation tree hash equally; this is the basis for
 * the import dedupe.
 */
export const hashWorkspace = (
  workspace: Pick<ExportedWorkspace, 'name' | 'currentNodeId' | 'tree'>,
  options?: { ignoreName?: boolean }
): string => {
  const { name, currentNodeId, tree } = workspace;

  const idMap: Record<string, string> = {};
  let counter = 0;

  const traverse = (id: string) => {
    if (idMap[id] !== undefined) return;
    idMap[id] = String(counter++);
    const node = tree[id];
    if (node && node.childrenIds) {
      node.childrenIds.forEach(traverse);
    }
  };

  const rootId = ("0" in tree) ? "0" : Object.keys(tree)[0];
  if (rootId) {
    traverse(rootId);
  }

  Object.keys(tree).sort().forEach(id => {
    if (idMap[id] === undefined) {
      traverse(id);
    }
  });

  const canonicalTree: Record<string, {
    equation: SerializedEquation | string;
    parentId: string | null;
    childrenIds: string[];
    label: string;
    change?: unknown;
  }> = {};

  Object.keys(tree).forEach(id => {
    const node = tree[id];
    const mappedId = idMap[id] || id;
    canonicalTree[mappedId] = {
      equation: canonicalEquation(node.equation),
      parentId: node.parentId ? idMap[node.parentId] || null : null,
      childrenIds: (node.childrenIds || []).map(cid => idMap[cid] || cid),
      label: node.label || '',
      ...(node.change ? { change: node.change } : {})
    };
  });

  const canonicalWorkspace = options?.ignoreName
    ? {
        currentNodeId: idMap[currentNodeId] || currentNodeId,
        tree: canonicalTree
      }
    : {
        name,
        currentNodeId: idMap[currentNodeId] || currentNodeId,
        tree: canonicalTree
      };

  return djb2(JSON.stringify(canonicalize(canonicalWorkspace)));
};

const makeImportedId = (existing: Set<string>): string => {
  let id: string;
  do {
    id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } while (existing.has(id));
  existing.add(id);
  return id;
};

export interface MergeResult {
  merged: SavedSession[];
  /** How many incoming workspaces were skipped because their content already exists. */
  skipped: number;
}

/**
 * Merge imported workspaces into the existing saved-session list.
 *
 * - **Identical content** (by {@link hashWorkspace}) → skipped (re-importing the
 *   same file is a no-op).
 * - **Same id, different content** → appended as a new copy with a fresh id and
 *   a name suffixed `(imported)`; the existing entry is left untouched.
 * - **Otherwise** → appended as-is.
 */
export const mergeWorkspaces = (
  existing: SavedSession[],
  incoming: ExportedWorkspace[],
): MergeResult => {
  const usedIds = new Set(existing.map(s => s.id));
  const contentHashes = new Set(existing.map(s => hashWorkspace(s)));
  const merged = [...existing];
  let skipped = 0;

  for (const ws of incoming) {
    const hash = hashWorkspace(ws);
    if (contentHashes.has(hash)) {
      skipped++;
      continue;
    }

    const idCollision = usedIds.has(ws.id);
    const session: SavedSession = {
      id: idCollision ? makeImportedId(usedIds) : ws.id,
      name: idCollision ? `${ws.name} (imported)` : ws.name,
      timestamp: ws.timestamp,
      tree: ws.tree,
      currentNodeId: ws.currentNodeId,
    };
    if (!idCollision) usedIds.add(session.id);
    contentHashes.add(hash);
    merged.push(session);
  }

  return { merged, skipped };
};
