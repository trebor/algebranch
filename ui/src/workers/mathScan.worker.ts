// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { deserializeEquation, SerializedEquation } from 'math-engine-client';
import { computeMathSync, getHintLadder, HintLadder, HintOptions } from 'math-engine';

export interface WorkerScanRequest {
  type?: 'computeMath' | 'getHintLadder';
  serializedEq: SerializedEquation;
  sourcePath?: string | null;
  customTargetVar?: string;
  hintOptions?: HintOptions;
  epoch: number;
}

export interface WorkerScanResponse {
  type?: 'computeMath' | 'getHintLadder';
  result?: ReturnType<typeof computeMathSync>;
  hintLadder?: HintLadder | null;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  epoch: number;
}

self.onmessage = (event: MessageEvent<WorkerScanRequest>) => {
  const { type = 'computeMath', serializedEq, sourcePath, customTargetVar, hintOptions, epoch } = event.data;

  try {
    const eq = deserializeEquation(serializedEq);
    if (type === 'getHintLadder') {
      const hintLadder = getHintLadder(eq, customTargetVar, hintOptions);
      const response: WorkerScanResponse = { type: 'getHintLadder', hintLadder, epoch };
      self.postMessage(response);
    } else {
      const result = computeMathSync(eq, sourcePath || null);
      const response: WorkerScanResponse = { type: 'computeMath', result, epoch };
      self.postMessage(response);
    }
  } catch (error: unknown) {
    const err = error as Error;
    const response: WorkerScanResponse = {
      type,
      error: {
        name: err.name || 'Error',
        message: err.message || String(err),
        stack: err.stack,
      },
      epoch,
    };
    self.postMessage(response);
  }
};
