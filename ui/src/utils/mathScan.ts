// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { Equation, equationToString, serializeEquation, deserializeEquation, SerializedEquation } from 'math-engine-client';
// computeMathSync wraps the heavy solving surface (generateValidMoves /
// getReducibleOptions), so — like those — it is imported directly from the
// engine rather than through the lightweight math-engine-client shim.
import type { MathSyncResult } from 'math-engine';
import type { OnboardingChapter } from '../store/equation';

import { runWorkerScan } from './workerScan';

export type MathScanResult = MathSyncResult;

// Module-level scan cache: deterministic calculation inputs -> scan result.
// Keys include node IDs (serializedEq) so cache hits preserve FLIP continuity.
const scanCache = new Map<string, MathScanResult>();

/**
 * Compute the math scan (candidate/target/reducible analysis) for an equation
 * state, with caching so repeated requests for the same state reuse one result.
 *
 * The analysis runs fully client-side via the engine's `computeMathSync` (#136)
 * offloaded to a Web Worker; the async signature is retained so callers stay
 * unchanged from when this was a `POST /api/math` round-trip.
 */
export const fetchMathScan = async (
  eq: Equation,
  sourcePath: string | null,
  options?: { isActive?: () => boolean }
): Promise<MathScanResult> => {
  const eqStr = equationToString(eq);
  const serializedEq = serializeEquation(eq);
  const cacheKey = JSON.stringify({ eqStr, serializedEq, sourcePath });

  const cached = scanCache.get(cacheKey);
  if (cached) return cached;

  // Yield to the event loop so the browser can paint the static equation and loading state.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  if (options?.isActive && !options.isActive()) {
    const err = new Error('The operation was aborted.');
    err.name = 'AbortError';
    throw err;
  }

  const data = await runWorkerScan(eq, sourcePath, options?.isActive);
  scanCache.set(cacheKey, data);
  return data;
};

const strip = (s: string) => s.replace(/\s+/g, '');

/**
 * Pre-warm the scan cache for a tutorial chapter by walking its known step
 * chain at chapter start. Each future state is taken from the previous scan's
 * own results (targets / reduce actions), so node IDs — and therefore cache
 * keys — match exactly what the live session will request as the user steps
 * through. Stops silently at any transition it can't derive (e.g. global ops);
 * those states simply fall back to live fetches.
 */
export const prefetchChapterScans = async (
  chapter: OnboardingChapter,
  startEq: Equation,
  isActive: () => boolean
): Promise<void> => {
  let eq = startEq;
  if (strip(equationToString(eq)) !== strip(chapter.initialEquation)) return;

  let base = await fetchMathScan(eq, null, { isActive });
  let pendingTargets: Record<string, SerializedEquation> | null = null;

  for (const step of chapter.steps) {
    if (!isActive()) return;
    if (!step.nextEquation) break; // chapter-complete step

    const nextStr = strip(step.nextEquation);
    if (nextStr === strip(equationToString(eq))) {
      // No-op step. Selection prompts warm the selection scan whose targets
      // the following transpose step will click.
      if (step.highlightPath) {
        const sel = await fetchMathScan(eq, step.highlightPath, { isActive });
        pendingTargets = sel.targetPaths;
      }
      continue;
    }

    // Action step: locate the resulting state among known scan results
    let nextSer: SerializedEquation | undefined;

    // 1. A reduce/distribute handle on the current state
    for (const actions of Object.values(base.reduciblePaths)) {
      const hit = actions.find(a => strip(equationToString(deserializeEquation(a.equation))) === nextStr);
      if (hit) {
        nextSer = hit.equation;
        break;
      }
    }

    // 2. A transposition target from the prior selection (or this step's own selection)
    if (!nextSer) {
      let targets = pendingTargets;
      const selPath = step.selectPath || step.highlightPath;
      if (!targets && selPath) {
        const sel = await fetchMathScan(eq, selPath, { isActive });
        targets = sel.targetPaths;
      }
      if (targets) {
        nextSer = Object.values(targets).find(t => strip(equationToString(deserializeEquation(t))) === nextStr);
      }
    }

    if (!nextSer) return; // underivable transition — let the live flow fetch it

    eq = deserializeEquation(nextSer);
    pendingTargets = null;
    base = await fetchMathScan(eq, null, { isActive });
  }
};
