// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The one-shot sessionStorage handoff that carries a decrypted `/s#key` payload to
// the `/` workspace loader (#480). Runs in the default jsdom env for `sessionStorage`.
// The contract that matters: consuming clears it, so a refresh of `/` never re-loads
// the shared workspace, and an absent handoff reads as null (the normal case).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  stashPendingShare,
  consumePendingShare,
  resolveInitialWsSource,
} from '@/utils/shareLink';

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

describe('resolveInitialWsSource (?ws= precedence)', () => {
  // Guards the core "?ws= links are unaffected by short links" (#480) property:
  // an explicit `?ws=` in the URL must always win over a stashed `/s#key` handoff,
  // so classic stateless links load unchanged even if a stale handoff lingers.
  it('prefers an explicit ?ws= param over a pending short-link handoff', () => {
    expect(resolveInitialWsSource('WS_FROM_URL', 'WS_FROM_SHORT_LINK')).toBe('WS_FROM_URL');
  });

  it('uses the pending handoff when no ?ws= param is present', () => {
    expect(resolveInitialWsSource(null, 'WS_FROM_SHORT_LINK')).toBe('WS_FROM_SHORT_LINK');
  });

  it('returns null when neither is present (the ?eq=/saved-session paths take over)', () => {
    expect(resolveInitialWsSource(null, null)).toBeNull();
  });
});
