import { Equation, equationToString, serializeEquation, deserializeEquation, SerializedEquation } from 'math-engine-client';
import type { OnboardingChapter } from '../store/equation';

const API_MATH_ENDPOINT = '/api/math';

export interface MathScanResult {
  activePaths: string[];
  reduciblePaths: Record<string, { equation: SerializedEquation; type: 'reduce' | 'distribute' | 'identity'; label?: string }[]>;
  targetPaths: Record<string, SerializedEquation>;
}

// Module-level scan cache: deterministic calculation inputs -> server response.
// Keys include node IDs (serializedEq) so cache hits preserve FLIP continuity.
const scanCache = new Map<string, MathScanResult>();
const inFlightScans = new Map<string, Promise<MathScanResult>>();

/**
 * Fetch the math scan (candidate/target/reducible analysis) for an equation
 * state, with caching and in-flight deduplication so concurrent requests for
 * the same state share one round-trip.
 */
export const fetchMathScan = (eq: Equation, sourcePath: string | null): Promise<MathScanResult> => {
  const eqStr = equationToString(eq);
  const serializedEq = serializeEquation(eq);
  const cacheKey = JSON.stringify({ eqStr, serializedEq, sourcePath });

  const cached = scanCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const pending = inFlightScans.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(API_MATH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-state', eqStr, serializedEq, sourcePath })
      });
      const data: MathScanResult = await res.json();
      scanCache.set(cacheKey, data);
      return data;
    } finally {
      inFlightScans.delete(cacheKey);
    }
  })();
  inFlightScans.set(cacheKey, request);
  return request;
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

  let base = await fetchMathScan(eq, null);
  let pendingTargets: Record<string, SerializedEquation> | null = null;

  for (const step of chapter.steps) {
    if (!isActive()) return;
    if (!step.nextEquation) break; // chapter-complete step

    const nextStr = strip(step.nextEquation);
    if (nextStr === strip(equationToString(eq))) {
      // No-op step. Selection prompts warm the selection scan whose targets
      // the following transpose step will click.
      if (step.highlightPath) {
        const sel = await fetchMathScan(eq, step.highlightPath);
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
        const sel = await fetchMathScan(eq, selPath);
        targets = sel.targetPaths;
      }
      if (targets) {
        nextSer = Object.values(targets).find(t => strip(equationToString(deserializeEquation(t))) === nextStr);
      }
    }

    if (!nextSer) return; // underivable transition — let the live flow fetch it

    eq = deserializeEquation(nextSer);
    pendingTargets = null;
    base = await fetchMathScan(eq, null);
  }
};
