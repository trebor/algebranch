// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import {
  serializeWorkspacesToJson,
  parseWorkspacesJson,
  hashWorkspace,
  mergeWorkspaces,
  WORKSPACE_FILE_APP,
  WORKSPACE_FILE_VERSION,
  ExportedWorkspace,
} from '../../ui/src/utils/workspaceTransfer';

// Minimal SavedSession-shaped fixtures. The transfer helpers never interpret
// the equation payload, so a bare object stands in for SerializedEquation.
const makeSession = (over: Partial<any> = {}): any => ({
  id: 'session_1',
  name: 'Quadratics',
  timestamp: 1000,
  currentNodeId: '0',
  tree: {
    '0': {
      id: '0',
      equation: 'x^2=9',
      parentId: null,
      childrenIds: [],
      label: 'Start',
      timestamp: 1000,
    },
  },
  ...over,
});

describe('serializeWorkspacesToJson / parseWorkspacesJson round-trip', () => {
  test('round-trips a workspace through serialize → parse', () => {
    const session = makeSession();
    const json = serializeWorkspacesToJson([session]);
    const parsed = parseWorkspacesJson(json);

    expect(parsed.app).toBe(WORKSPACE_FILE_APP);
    expect(parsed.version).toBe(WORKSPACE_FILE_VERSION);
    expect(parsed.workspaces).toHaveLength(1);
    expect(parsed.workspaces[0]).toMatchObject({
      id: 'session_1',
      name: 'Quadratics',
      currentNodeId: '0',
    });
    expect(parsed.workspaces[0].tree['0'].equation).toEqual('x^2=9');
  });

  test('excludes tutorial/onboarding (chapterId-bound) sessions from export', () => {
    const normal = makeSession({ id: 'session_a', name: 'Mine' });
    const chapter = makeSession({ id: 'session_b', name: 'Chapter 1', chapterId: 'ch1' });
    const parsed = parseWorkspacesJson(serializeWorkspacesToJson([normal, chapter]));

    expect(parsed.workspaces).toHaveLength(1);
    expect(parsed.workspaces[0].id).toBe('session_a');
  });

  test('omits the chapterId field entirely from exported workspaces', () => {
    const parsed = parseWorkspacesJson(serializeWorkspacesToJson([makeSession()]));
    expect('chapterId' in parsed.workspaces[0]).toBe(false);
  });
});

describe('parseWorkspacesJson validation', () => {
  test('rejects non-JSON text', () => {
    expect(() => parseWorkspacesJson('not json {')).toThrow();
  });

  test('rejects foreign JSON without the algebranch app marker', () => {
    const foreign = JSON.stringify({ version: 1, workspaces: [] });
    expect(() => parseWorkspacesJson(foreign)).toThrow(/algebranch/i);
  });

  test('rejects an unsupported version', () => {
    const future = JSON.stringify({ app: WORKSPACE_FILE_APP, version: 999, workspaces: [] });
    expect(() => parseWorkspacesJson(future)).toThrow(/version/i);
  });

  test('rejects when workspaces is not an array', () => {
    const bad = JSON.stringify({ app: WORKSPACE_FILE_APP, version: 1, workspaces: {} });
    expect(() => parseWorkspacesJson(bad)).toThrow();
  });

  test('rejects a workspace entry missing tree/currentNodeId', () => {
    const bad = JSON.stringify({
      app: WORKSPACE_FILE_APP,
      version: 1,
      workspaces: [{ id: 'x', name: 'No tree', timestamp: 1 }],
    });
    expect(() => parseWorkspacesJson(bad)).toThrow();
  });
});

describe('hashWorkspace', () => {
  test('ignores id and timestamp', () => {
    const a = makeSession({ id: 'session_1', timestamp: 1 });
    const b = makeSession({ id: 'session_999', timestamp: 999999 });
    expect(hashWorkspace(a)).toBe(hashWorkspace(b));
  });

  test('ignores node-key ordering within the tree', () => {
    const base = makeSession();
    const reordered = makeSession();
    reordered.tree = {
      '1': { id: '1', equation: 'x=2', parentId: '0', childrenIds: [], label: 'B', timestamp: 2 },
      '0': { id: '0', equation: 'x=1', parentId: null, childrenIds: ['1'], label: 'A', timestamp: 1 },
    };
    base.tree = {
      '0': { id: '0', equation: 'x=1', parentId: null, childrenIds: ['1'], label: 'A', timestamp: 1 },
      '1': { id: '1', equation: 'x=2', parentId: '0', childrenIds: [], label: 'B', timestamp: 2 },
    };
    expect(hashWorkspace(base)).toBe(hashWorkspace(reordered));
  });

  test('differs when tree content differs', () => {
    const a = makeSession();
    const b = makeSession();
    b.tree['0'].equation = 'x=5';
    expect(hashWorkspace(a)).not.toBe(hashWorkspace(b));
  });
});

describe('mergeWorkspaces', () => {
  const toExported = (s: any): ExportedWorkspace => ({
    id: s.id,
    name: s.name,
    timestamp: s.timestamp,
    tree: s.tree,
    currentNodeId: s.currentNodeId,
  });

  test('re-importing identical content is a no-op (skipped by content hash)', () => {
    const existing = [makeSession({ id: 'session_1' })];
    const incoming = [toExported(makeSession({ id: 'session_1' }))];
    const { merged, skipped } = mergeWorkspaces(existing, incoming);
    expect(skipped).toBe(1);
    expect(merged).toHaveLength(1);
  });

  test('identical content under a different id is still skipped', () => {
    const existing = [makeSession({ id: 'session_1' })];
    const incoming = [toExported(makeSession({ id: 'session_other' }))];
    const { merged, skipped } = mergeWorkspaces(existing, incoming);
    expect(skipped).toBe(1);
    expect(merged).toHaveLength(1);
  });

  test('same id but different content produces a new copy and preserves the original', () => {
    const existing = [makeSession({ id: 'session_1', name: 'Original' })];
    const variant = makeSession({ id: 'session_1', name: 'Original' });
    variant.tree['0'].equation = 'x=42';
    const { merged, skipped } = mergeWorkspaces(existing, [toExported(variant)]);

    expect(skipped).toBe(0);
    expect(merged).toHaveLength(2);
    // Original is preserved untouched.
    const original = merged.find(w => w.id === 'session_1');
    expect(original?.name).toBe('Original');
    // The imported copy got a fresh, distinct id and a marked name.
    const copy = merged.find(w => w.id !== 'session_1');
    expect(copy).toBeDefined();
    expect(copy!.id).not.toBe('session_1');
    expect(copy!.name).toContain('imported');
  });

  test('a genuinely new workspace is appended as-is', () => {
    const existing = [makeSession({ id: 'session_1' })];
    const fresh = makeSession({ id: 'session_2', name: 'Fresh' });
    fresh.tree['0'].equation = 'y=2x';
    const { merged, skipped } = mergeWorkspaces(existing, [toExported(fresh)]);

    expect(skipped).toBe(0);
    expect(merged).toHaveLength(2);
    expect(merged.find(w => w.id === 'session_2')).toBeDefined();
  });
});
