// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Golden share-link fixtures (#451). replayWorkspace.test.ts round-trips through
// the *current* encoder, so a refactor that silently changes the wire format
// still passes it while breaking every link already in the wild. These fixtures
// are LITERAL `?ws=` / `?eq=` strings generated once (2026-07-07) and frozen
// forever: the test decodes them with today's decoder and asserts the exact tree
// they must always yield. If a future change breaks decode of one of these, it
// has broken previously shared links — the whole point of the guard. Regenerate
// (adding a NEW fixture, never editing an old one) only to lock a new format.
import { describe, it, expect } from 'vitest';
import {
  deserializeTree,
  deminifyReplayWorkspace,
  deminifyWorkspace,
  WS_REPLAY_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  type SerializedHistoryNode,
} from '@/store/equation';
import { decompressString, equationToString, parseEquation } from 'math-engine-client';
import { decodeEqParam } from '@/utils/eqParam';

// The tree every `?ws=` fixture below encodes: `2 * x + 3 = 10` → global −3 →
// simplify → global ÷2. Four nodes; these equation strings are the invariant.
const EXPECTED_EQS = [
  '2 * x + 3 - 3 = 10 - 3',
  '2 * x + 3 = 10',
  '2 * x / 2 = (10 - 3) / 2',
  '2 * x = 10 - 3',
];
const EXPECTED_ROOT = '2 * x + 3 = 10';

/** Route a decoded envelope through the same decode paths as page.tsx. */
const decodeEnvelope = (
  envelope: Record<string, unknown>,
): { tree: Record<string, SerializedHistoryNode>; currentNodeId: string; name: string } => {
  if (envelope.v === WS_REPLAY_VERSION && Array.isArray(envelope.r)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return deminifyReplayWorkspace(envelope as any);
  }
  if (SUPPORTED_SCHEMA_VERSIONS.has(envelope.v as number) && envelope.t) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return deminifyWorkspace(envelope as any);
  }
  if (SUPPORTED_SCHEMA_VERSIONS.has(envelope.version as number) && envelope.payload) {
    const p = envelope.payload as { tree: Record<string, SerializedHistoryNode>; currentNodeId: string; name: string };
    return { tree: p.tree, currentNodeId: p.currentNodeId, name: p.name };
  }
  throw new Error('unrecognized envelope');
};

const decodeWsFixture = async (ws: string) => {
  const envelope = JSON.parse(await decompressString(ws));
  const { tree, currentNodeId, name } = decodeEnvelope(envelope);
  const live = deserializeTree(tree);
  const eqs = Object.values(live).map(n => equationToString(n.equation)).sort();
  return { live, currentNodeId, name, eqs };
};

describe('golden share-link fixtures (#451)', () => {
  it('decodes a frozen replay (v3) `?ws=` link', async () => {
    const FIXTURE = 'eJxFjksKwkAQRK_S1FJrMJ_dgOsg7hRUCFlMMOJAm4-KGMRzeQAvJq0Ll6-qeNQDN_icOMOXpUuJAUQmE7nLVHKZS5qAWLTxGoOiYpkQNQgHIgdRaFcHFScGy40tUrMReryACbGOp17jYTTvzvrsZ5hZ8De8X2K0HVBVRPs9FeBRdLpvWlk1vYYRzw-2yS0M';
    const { live, currentNodeId, name, eqs } = await decodeWsFixture(FIXTURE);
    expect(eqs).toEqual(EXPECTED_EQS);
    expect(equationToString(live[currentNodeId].equation)).toBe('2 * x / 2 = (10 - 3) / 2');
    const root = Object.values(live).find(n => n.parentId === null)!;
    expect(equationToString(root.equation)).toBe(EXPECTED_ROOT);
    expect(name).toBe('Golden Replay');
  });

  it('decodes a frozen minified (v2) `?ws=` link', async () => {
    const FIXTURE = 'eJx9kU1uwjAQha8yeqv-TFXi9NcS66prpG4qFgkxxcIkKDEUhHKuHqAXq8bEpQHUTZTxvJn3Ps0Oa2jF8NA7DORjoTEAw0jRQEPRFW3omlIaUiKdOfR7kCRgKDBSMO7AuMe4ZSyhy5VzjInoEowZDhqvpfU2c2hlrvNJzvvcdF7yE_0ewGc9H8F4Ct6M5-gflMFeRfsXV-WZ6zbOxHNuywIaeeVnI1uYBoxKZptV7uts4kNt6iyoZMqbjf_Tp5SmdbUgWUBN2NC2Eq6DU6dwx1AZGHmIeg4iiRBphBjZxdLZ6fYIoTaftfUGjGm2sG4rIQ_KPdShjhjxRUKnMXR6GvqWFA3pYp_8UsoYvwD3EEKCHgrj4xdHdTj9g3x_hX3_XqSwa1uY3j3UAWTf_XMGyrek0ApX2SFlYli5wpT0ptD-AGg1wmY';
    const { name, eqs } = await decodeWsFixture(FIXTURE);
    expect(eqs).toEqual(EXPECTED_EQS);
    expect(name).toBe('Golden V2');
  });

  it('decodes a frozen legacy (v1) `?ws=` link', async () => {
    const FIXTURE = 'eJztlMGO2jAURX8luss2oxJ7RqoiddXFiE27QOqmGiEHm8GtYwfHYYhQvqsf0B-rnElIMkADtItR1Q0I8u51_N65b4eNsLk0GnEUImOlMowj3sFZIfz3xH9IjhgThBDrgrm6ege1yuvCMhOI8TkTljljPxkuED4rtOFiLiec0Nu5V5sMMd4ixFIjBuMcIZh9zBF_Pdsnan3etD5poZzMVHnE7KPRuWPanTIjCLFhqhCISRXuZbMyTYw6JaIIoVnqC7eoHnq6seNuu-OoF8IOWjgmv-vk0cSrhWqGgQ-o_PSs0G7KEetCqRCLlVTcCj3lvinIncjmER5CKJYIhRhTLZ1kCiGcTEXuWJoh9s5NaTv55udV43fZYvV-0o3_ph1bXiTOsoW7goH_LB2yNC5sJhH9HsKxQZJLBnkh0WffgR7c4WQU6rV1LAmkn4R7ZRKmgpuADsMQeS3Tj_Uq_C61N0yMW80kF3nbiV4DjO9eXVUbia3rPQ9osLQmDbxBkNcOVRs2MgwbuS5sT3dUs3WXjz_iujGLLuK6EZGXXP_rlO1X5DHUaB-1mUwzJZflEDRyBDQrnqx0_tWWLJWq9Md04mf0emYNbO0_e7ToEC16HVpLs_221h1a79rBcLmRde3Z2_f1Ujp-XNOGwXEX4N3IyV_o4mtOytl9pAd9HIkYOYjY4Rb_-SMgw3TRc9b4fgTdEiddrp6f9nZ3kJQBQeVjtiisf0t_yekgZw1c90ZxoYMvEarqF3TzpVA';
    const { name, eqs } = await decodeWsFixture(FIXTURE);
    expect(eqs).toEqual(EXPECTED_EQS);
    expect(name).toBe('Golden V1');
  });

  it('decodes a frozen `?eq=` link', () => {
    const FIXTURE = 'MiAqIHggKyAzID0gMTA';
    const decoded = decodeEqParam(FIXTURE, (s) => {
      try { parseEquation(s); return true; } catch { return false; }
    });
    expect(decoded).toBe('2 * x + 3 = 10');
  });
});
