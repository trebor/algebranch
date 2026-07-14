// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { deserializeEquation, SerializedEquation } from 'math-engine-client';
import { computeMathSync } from 'math-engine';

export interface WorkerScanRequest {
  serializedEq: SerializedEquation;
  sourcePath: string | null;
  epoch: number;
}

export interface WorkerScanResponse {
  result?: ReturnType<typeof computeMathSync>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  epoch: number;
}

self.onmessage = (event: MessageEvent<WorkerScanRequest>) => {
  const { serializedEq, sourcePath, epoch } = event.data;

  try {
    const eq = deserializeEquation(serializedEq);
    const result = computeMathSync(eq, sourcePath);
    const response: WorkerScanResponse = { result, epoch };
    self.postMessage(response);
  } catch (error: unknown) {
    const err = error as Error;
    const response: WorkerScanResponse = {
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
