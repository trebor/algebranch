// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEpochGate, runWorkerScan, resetWorkerForTest } from '../src/utils/workerScan';
import { parseEquation } from 'math-engine';

describe('createEpochGate', () => {
  it('should resolve the latest request and reject stale ones under interleaving', async () => {
    const gate = createEpochGate();
    const results: string[] = [];
    const errors: string[] = [];

    const runTask = async (name: string, delayMs: number) => {
      const { check } = gate.next();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        check();
        results.push(name);
      } catch (err: unknown) {
        if (err instanceof Error) {
          errors.push(`${name}:${err.name}`);
        }
      }
    };

    // Task A starts first, finishes in 50ms
    // Task B starts at 10ms, finishes in 20ms (total time 30ms)
    // Since Task B started after Task A, Task A becomes stale.
    const p1 = runTask('A', 50);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const p2 = runTask('B', 20);

    await Promise.all([p1, p2]);

    expect(results).toEqual(['B']);
    expect(errors).toEqual(['A:AbortError']);
  });

  it('should support explicit cancellation', async () => {
    const gate = createEpochGate();
    const results: string[] = [];
    const errors: string[] = [];

    const runTask = async (name: string, delayMs: number) => {
      const { check } = gate.next();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        check();
        results.push(name);
      } catch (err: unknown) {
        if (err instanceof Error) {
          errors.push(`${name}:${err.name}`);
        }
      }
    };

    const p = runTask('A', 30);
    gate.cancel();
    await p;

    expect(results).toEqual([]);
    expect(errors).toEqual(['A:AbortError']);
  });
});

describe('runWorkerScan', () => {
  let originalWorker: typeof Worker | undefined;
  let mockWorkerInstances: MockWorker[] = [];

  class MockWorker {
    onmessage: ((ev: MessageEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor(public url: URL) {
      mockWorkerInstances.push(this);
    }
  }

  beforeEach(() => {
    originalWorker = globalThis.Worker;
    mockWorkerInstances = [];
    resetWorkerForTest();
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.Worker = originalWorker as typeof Worker;
    vi.useRealTimers();
  });

  it('should fallback to synchronous main-thread scan when Worker is unavailable', async () => {
    // Delete Worker from globals
    // @ts-expect-error - testing fallback when undefined
    delete globalThis.Worker;

    const eq = parseEquation('x + 1 = 2');
    const resultPromise = runWorkerScan(eq, null);
    
    // Fallback is synchronous (wrapped in Promise.resolve)
    const result = await resultPromise;
    expect(result).toBeDefined();
    expect(result.targetPaths).toBeDefined();
  });

  it('should run via Web Worker when Worker is available', async () => {
    globalThis.Worker = MockWorker as unknown as typeof Worker;

    const eq = parseEquation('x + 1 = 2');
    const resultPromise = runWorkerScan(eq, null);

    expect(mockWorkerInstances).toHaveLength(1);
    const workerInstance = mockWorkerInstances[0];
    expect(workerInstance.postMessage).toHaveBeenCalledTimes(1);

    const sentEpoch = workerInstance.postMessage.mock.calls[0][0].epoch;

    // Simulate worker responding successfully
    const mockResult = {
      targetPaths: {},
      reduciblePaths: {},
      candidatePaths: {},
    };

    workerInstance.onmessage!({
      data: {
        result: mockResult,
        epoch: sentEpoch,
      },
    } as MessageEvent);

    const result = await resultPromise;
    expect(result).toEqual(mockResult);
  });

  it('should reject previous request with AbortError when a new request is initiated', async () => {
    globalThis.Worker = MockWorker as unknown as typeof Worker;

    const eq1 = parseEquation('x + 1 = 2');
    const eq2 = parseEquation('x + 2 = 3');

    const promise1 = runWorkerScan(eq1, null);
    const workerInstance = mockWorkerInstances[0];

    const promise2 = runWorkerScan(eq2, null);

    // Promise 1 should have been rejected immediately
    await expect(promise1).rejects.toThrow('The operation was aborted.');

    // Retrieve the sent epoch for the second call
    const sentEpoch = workerInstance.postMessage.mock.calls[1][0].epoch;

    // Now complete the second request
    const mockResult2 = { targetPaths: { '0': {} } };
    workerInstance.onmessage!({
      data: {
        result: mockResult2,
        epoch: sentEpoch,
      },
    } as MessageEvent);

    const result2 = await promise2;
    expect(result2).toEqual(mockResult2);
  });

  it('should reject with TimeoutError and terminate worker if worker does not respond in time', async () => {
    globalThis.Worker = MockWorker as unknown as typeof Worker;

    const eq = parseEquation('x + 1 = 2');
    const resultPromise = runWorkerScan(eq, null);

    expect(mockWorkerInstances).toHaveLength(1);
    const workerInstance = mockWorkerInstances[0];

    // Fast-forward time to trigger timeout (10 seconds)
    vi.advanceTimersByTime(10000);

    await expect(resultPromise).rejects.toThrow('The operation timed out.');
    expect(workerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  it('should reject with AbortError if isActive becomes false during execution', async () => {
    globalThis.Worker = MockWorker as unknown as typeof Worker;

    let active = true;
    const eq = parseEquation('x + 1 = 2');
    const resultPromise = runWorkerScan(eq, null, () => active);

    expect(mockWorkerInstances).toHaveLength(1);
    const workerInstance = mockWorkerInstances[0];
    const sentEpoch = workerInstance.postMessage.mock.calls[0][0].epoch;

    // Cancel active state
    active = false;

    // Send result back
    const mockResult = { targetPaths: {} };
    workerInstance.onmessage!({
      data: {
        result: mockResult,
        epoch: sentEpoch,
      },
    } as MessageEvent);

    await expect(resultPromise).rejects.toThrow('The operation was aborted.');
  });
});
