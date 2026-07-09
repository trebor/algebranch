// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The one-shot sessionStorage handoff that carries a decrypted `/s#key` payload to
// the `/` workspace loader (#480). Runs in the default jsdom env for `sessionStorage`.
// The contract that matters: consuming clears it, so a refresh of `/` never re-loads
// the shared workspace, and an absent handoff reads as null (the normal case).
import { describe, it, expect, beforeEach } from 'vitest';
import { stashPendingShare, consumePendingShare } from '@/utils/shareLink';

describe('pending share handoff', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips a stashed payload once', () => {
    stashPendingShare('COMPRESSED_WS');
    expect(consumePendingShare()).toBe('COMPRESSED_WS');
  });

  it('clears on consume so a refresh does not re-load (one-shot)', () => {
    stashPendingShare('COMPRESSED_WS');
    expect(consumePendingShare()).toBe('COMPRESSED_WS');
    expect(consumePendingShare()).toBeNull();
  });

  it('returns null when nothing is waiting', () => {
    expect(consumePendingShare()).toBeNull();
  });
});
