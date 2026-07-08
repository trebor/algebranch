// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import type { Equation } from 'math-engine-client';
import { currentEquationAtom } from '../store/equation';
import { computePreviewDiff } from '../utils/previewDiff';

/**
 * Diff signal for transform-result previews (#423). `null` (the default) means
 * "no diff emphasis — render as today"; a Set holds the ids of preview nodes that
 * carried over unchanged from the live equation, which {@link PreviewEquationNode}
 * dims so the changed/new nodes stay vivid and the eye lands on the actual change.
 */
export const EquationPreviewDiffContext =
  React.createContext<ReadonlySet<string> | null>(null);

export const usePreviewDiffCarriedIds = (): ReadonlySet<string> | null =>
  React.useContext(EquationPreviewDiffContext);

/**
 * Whether the rendering node sits inside a subtree that changed — true once any
 * ancestor carried a fresh id (#423). A node dims only when it carried over *and*
 * no ancestor changed (genuinely untouched context); once inside a change, even a
 * carried leaf stays vivid, so the whole transformed region reads as the change
 * rather than leaving stray dim islands where a node's id happened to survive.
 */
export const PreviewChangedRegionContext = React.createContext<boolean>(false);

export const useInChangedRegion = (): boolean =>
  React.useContext(PreviewChangedRegionContext);

/**
 * Wraps a transform-result preview and provides its carried-over-node diff against
 * the live equation. Emits `null` whenever the diff has nothing to say (full
 * rebuild or no change — see {@link computePreviewDiff}), so those previews render
 * exactly as before.
 */
export const PreviewDiffProvider: React.FC<{
  previewEquation: Equation;
  children: React.ReactNode;
}> = ({ previewEquation, children }) => {
  const currentEq = useAtomValue(currentEquationAtom);
  const carried = React.useMemo(
    () => computePreviewDiff(currentEq, previewEquation),
    [currentEq, previewEquation],
  );
  return (
    <EquationPreviewDiffContext.Provider value={carried}>
      {children}
    </EquationPreviewDiffContext.Provider>
  );
};
