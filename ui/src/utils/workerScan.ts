// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { Equation, serializeEquation } from 'math-engine-client';
import { computeMathSync, MathSyncResult } from 'math-engine';
import type { WorkerScanResponse } from '../workers/mathScan.worker';

const SOLVE_TIMEOUT_MS = 10000;

/**
 * Creates an epoch-based staleness gate to manage async requests where only the
 * latest request should resolve, and all older or cancelled requests are aborted.
 */
export const createEpochGate = () => {
  let currentEpoch = 0;

  const next = (): { epoch: number; check: () => void } => {
    currentEpoch += 1;
    const requestEpoch = currentEpoch;

    const check = (): void => {
      if (requestEpoch !== currentEpoch) {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        throw err;
      }
    };

    return { epoch: requestEpoch, check };
  };

  const cancel = (): void => {
    currentEpoch += 1;
  };

  const getCurrent = (): number => currentEpoch;

  return { next, cancel, getCurrent };
};

const gate = createEpochGate();
let worker: Worker | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let activeResolver: ((value: MathSyncResult) => void) | null = null;
let activeRejecter: ((reason: unknown) => void) | null = null;

const terminateWorker = (): void => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
};

const getWorker = (): Worker | null => {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/mathScan.worker.ts', import.meta.url));
    } catch (err) {
      console.warn('Failed to instantiate Web Worker, falling back to main-thread execution:', err);
      return null;
    }
  }
  return worker;
};

/** @internal */
export const resetWorkerForTest = (): void => {
  terminateWorker();
  activeResolver = null;
  activeRejecter = null;
};

/**
 * Executes a math scan via the Web Worker if available, falling back to the
 * main-thread synchronous implementation otherwise.
 */
export const runWorkerScan = (
  eq: Equation,
  sourcePath: string | null,
  isActive?: () => boolean
): Promise<MathSyncResult> => {
  const workerInstance = getWorker();
  if (!workerInstance) {
    return Promise.resolve(computeMathSync(eq, sourcePath));
  }

  // Clear any existing timeout
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  // Reject any previous pending scan
  if (activeRejecter) {
    const err = new Error('The operation was aborted.');
    err.name = 'AbortError';
    activeRejecter(err);
    activeResolver = null;
    activeRejecter = null;
  }

  const { epoch } = gate.next();

  workerInstance.onmessage = (event: MessageEvent<WorkerScanResponse>) => {
    const { result, error, epoch: respEpoch } = event.data;
    if (respEpoch === gate.getCurrent()) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (isActive && !isActive()) {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        activeRejecter?.(err);
      } else if (error) {
        const err = new Error(error.message);
        err.name = error.name;
        err.stack = error.stack;
        activeRejecter?.(err);
      } else if (result) {
        activeResolver?.(result);
      }
      activeResolver = null;
      activeRejecter = null;
    }
  };

  return new Promise<MathSyncResult>((resolve, reject) => {
    activeResolver = resolve;
    activeRejecter = reject;

    const serializedEq = serializeEquation(eq);
    workerInstance.postMessage({ serializedEq, sourcePath, epoch });

    timeoutId = setTimeout(() => {
      terminateWorker();
      const err = new Error('The operation timed out.');
      err.name = 'TimeoutError';
      reject(err);
      activeResolver = null;
      activeRejecter = null;
    }, SOLVE_TIMEOUT_MS);
  });
};
