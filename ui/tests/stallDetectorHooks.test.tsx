// @vitest-environment jsdom
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import {
  initialStallState,
  updateStallDetector,
  DEFAULT_STALL_TIMEOUT_MS,
  type StallDetectorState,
} from '@/utils/stallDetector';
import { trackEvent, ANALYTICS_EVENTS } from '@/utils/analytics';
import { getDerivationSteps, type HistoryNode } from '@/store/equation';

vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
  ANALYTICS_EVENTS: {
    STALL_DETECTED: 'stall_detected',
    HINT_REQUESTED: 'hint_requested',
  },
}));

vi.mock('@/store/equation', () => ({
  getDerivationSteps: vi.fn((tree: unknown, currentNodeId: string) => {
    // Return dummy steps length based on currentNodeId to simulate path length
    const stepsLength = currentNodeId === '0' ? 1 : 2;
    return new Array(stepsLength).fill({});
  }),
}));

const TestStallWrapper: React.FC<{
  isHydrated: boolean;
  activeTabId: string;
  currentNodeId: string;
  sourcePath: string | null;
  radialMenuOpen: boolean;
  tree: Record<string, HistoryNode>;
}> = ({
  isHydrated,
  activeTabId,
  currentNodeId,
  sourcePath,
  radialMenuOpen,
  tree,
}) => {
  // Stall detector state and tracking refs
  const stallStateRef = React.useRef<StallDetectorState | null>(null);
  const prevSourcePathRef = React.useRef<string | null>(null);
  const prevRadialMenuOpenRef = React.useRef<boolean>(false);
  const prevStateKeyRef = React.useRef<string>('');

  // 1. Sync interaction changes (select, deselect, open-handle, state-change) to the stall state ref
  React.useEffect(() => {
    if (!isHydrated) return;

    const timestamp = Date.now();
    const stateKey = `${activeTabId}-${currentNodeId}`;
    const steps = getDerivationSteps(tree, currentNodeId);
    const moveCount = Math.max(0, steps.length - 1);

    const timeoutMs = DEFAULT_STALL_TIMEOUT_MS;

    // Initialize if not exists
    if (!stallStateRef.current) {
      stallStateRef.current = initialStallState(timestamp, moveCount);
      prevSourcePathRef.current = sourcePath;
      prevRadialMenuOpenRef.current = radialMenuOpen;
      prevStateKeyRef.current = stateKey;
      return;
    }

    let nextState = stallStateRef.current;

    // Detect state change vs internal page interaction
    if (stateKey !== prevStateKeyRef.current) {
      const res = updateStallDetector(nextState, { kind: 'state-change', timestamp, moveCount }, timeoutMs);
      nextState = res.nextState;
      prevStateKeyRef.current = stateKey;
      prevSourcePathRef.current = null;
      prevRadialMenuOpenRef.current = false;
    } else {
      // Check selection state change
      if (sourcePath !== prevSourcePathRef.current) {
        const isSelected = sourcePath !== null;
        const kind = isSelected ? 'select' : 'deselect';
        const res = updateStallDetector(nextState, { kind, timestamp }, timeoutMs);
        nextState = res.nextState;
        prevSourcePathRef.current = sourcePath;
      }

      // Check handle opened state change
      if (radialMenuOpen && !prevRadialMenuOpenRef.current) {
        const res = updateStallDetector(nextState, { kind: 'open-handle', timestamp }, timeoutMs);
        nextState = res.nextState;
      }
      prevRadialMenuOpenRef.current = radialMenuOpen;
    }

    stallStateRef.current = nextState;
  }, [activeTabId, currentNodeId, sourcePath, radialMenuOpen, tree, isHydrated]);

  // 2. Poll/tick every second to check for elapsed timeouts and trigger stall analytics events
  React.useEffect(() => {
    if (!isHydrated) return;

    const timeoutMs = DEFAULT_STALL_TIMEOUT_MS;
    const steps = getDerivationSteps(tree, currentNodeId);
    const moveCount = Math.max(0, steps.length - 1);

    const checkInterval = setInterval(() => {
      if (!stallStateRef.current) return;

      const timestamp = Date.now();
      const result = updateStallDetector(stallStateRef.current, { kind: 'tick', timestamp }, timeoutMs);

      stallStateRef.current = result.nextState;

      if (result.fireStall) {
        trackEvent({
          action: ANALYTICS_EVENTS.STALL_DETECTED,
          category: 'engagement',
          label: result.fireStall,
          value: moveCount,
        });
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [tree, currentNodeId, isHydrated]);

  return null;
};

describe('Stall detector React integrations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(trackEvent).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not check or track if isHydrated is false', () => {
    render(
      <TestStallWrapper
        isHydrated={false}
        activeTabId="tab1"
        currentNodeId="0"
        sourcePath={null}
        radialMenuOpen={false}
        tree={{}}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(35000);
    });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('fires selected-no-move after 30s of node/term selection', () => {
    const { rerender } = render(
      <TestStallWrapper
        isHydrated={true}
        activeTabId="tab1"
        currentNodeId="0"
        sourcePath={null}
        radialMenuOpen={false}
        tree={{}}
      />,
    );

    // Advance time slightly
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Select a term
    rerender(
      <TestStallWrapper
        isHydrated={true}
        activeTabId="tab1"
        currentNodeId="0"
        sourcePath="x"
        radialMenuOpen={false}
        tree={{}}
      />,
    );

    // Advance time by 29s
    act(() => {
      vi.advanceTimersByTime(29000);
    });
    expect(trackEvent).not.toHaveBeenCalled();

    // Advance by 1s (total 30s after select)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(trackEvent).toHaveBeenCalledWith({
      action: 'stall_detected',
      category: 'engagement',
      label: 'selected-no-move',
      value: 0,
    });
  });

  it('fires idle-after-move after 30s of inactivity if moveCount >= 1', () => {
    render(
      <TestStallWrapper
        isHydrated={true}
        activeTabId="tab1"
        currentNodeId="1" // Mocked to yield steps.length = 2 -> moveCount = 1
        sourcePath={null}
        radialMenuOpen={false}
        tree={{}}
      />,
    );

    // Advance by 29s
    act(() => {
      vi.advanceTimersByTime(29000);
    });
    expect(trackEvent).not.toHaveBeenCalled();

    // Advance to 30s
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(trackEvent).toHaveBeenCalledWith({
      action: 'stall_detected',
      category: 'engagement',
      label: 'idle-after-move',
      value: 1,
    });
  });
});
