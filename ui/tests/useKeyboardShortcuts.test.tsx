import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, ShortcutConfig } from '@/hooks/useKeyboardShortcuts';

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

describe('useKeyboardShortcuts — single chords (regression)', () => {
  it('fires a bare-key binding', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'g', action, description: 'Graph' }]));
    press('g');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('respects the Shift modifier', () => {
    const bare = vi.fn();
    const shifted = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        { key: 't', action: bare, description: 'Larger' },
        { key: 't', shift: true, action: shifted, description: 'Smaller' },
      ]),
    );
    press('t');
    press('T', { shiftKey: true });
    expect(bare).toHaveBeenCalledTimes(1);
    expect(shifted).toHaveBeenCalledTimes(1);
  });

  it('is suppressed when disabled', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'g', action, description: 'Graph' }], { disabled: true }));
    press('g');
    expect(action).not.toHaveBeenCalled();
  });
});

describe('useKeyboardShortcuts — leader sequences', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const seqBindings = (copyD: () => void, copyE: () => void): ShortcutConfig[] => [
    { leader: 'c', key: 'd', action: copyD, description: 'Copy derivation' },
    { leader: 'c', key: 'e', action: copyE, description: 'Copy equation' },
  ];

  it('fires when the full sequence is typed', () => {
    const copyD = vi.fn();
    const copyE = vi.fn();
    renderHook(() => useKeyboardShortcuts(seqBindings(copyD, copyE)));
    press('c');
    expect(copyD).not.toHaveBeenCalled(); // leader alone does nothing
    press('d');
    expect(copyD).toHaveBeenCalledTimes(1);
    expect(copyE).not.toHaveBeenCalled();
  });

  it('does not fire the leader as a bare chord', () => {
    const copyD = vi.fn();
    renderHook(() => useKeyboardShortcuts(seqBindings(copyD, vi.fn())));
    press('c');
    expect(copyD).not.toHaveBeenCalled();
  });

  it('aborts and falls through when the second key has no matching sequence', () => {
    const copyD = vi.fn();
    const graph = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        ...seqBindings(copyD, vi.fn()),
        { key: 'g', action: graph, description: 'Graph' },
      ]),
    );
    press('c'); // start sequence
    press('g'); // not a c-sequence; should fall through to the bare g binding
    expect(copyD).not.toHaveBeenCalled();
    expect(graph).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending leader after the timeout', () => {
    const copyD = vi.fn();
    renderHook(() => useKeyboardShortcuts(seqBindings(copyD, vi.fn())));
    press('c');
    vi.advanceTimersByTime(5000);
    press('d');
    expect(copyD).not.toHaveBeenCalled();
  });

  it('does not start a sequence when the leader is pressed with a modifier', () => {
    const copyD = vi.fn();
    renderHook(() => useKeyboardShortcuts(seqBindings(copyD, vi.fn())));
    press('c', { metaKey: true }); // e.g. native Cmd+C copy — must not arm the leader
    press('d');
    expect(copyD).not.toHaveBeenCalled();
  });

  it('reports pending-leader changes via the callback', () => {
    const onPendingLeader = vi.fn();
    const copyD = vi.fn();
    renderHook(() => useKeyboardShortcuts(seqBindings(copyD, vi.fn()), { onPendingLeader }));
    press('c');
    expect(onPendingLeader).toHaveBeenLastCalledWith('c');
    press('d');
    expect(onPendingLeader).toHaveBeenLastCalledWith(null);
  });
});
