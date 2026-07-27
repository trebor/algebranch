// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { atom } from 'jotai';
import { getHintLadder, HintLadder, isHintableEquation } from 'math-engine';
import {
  currentEquationAtom,
  filteredReduciblePathsAtom,
  settingsAtom,
  activeTabIdAtom,
  currentNodeIdAtom,
  toastAtom,
} from './equation';
import { runWorkerHint } from '../utils/workerScan';

export const rawHintActiveAtom = atom(false);
export const rawHintTabIdAtom = atom<string | null>(null);
export const rawHintNodeIdAtom = atom<string | null>(null);
export const rawHintLevelAtom = atom(1);
export const rawHintDrawerExpandedAtom = atom(false);

export const rawHintLadderAtom = atom<HintLadder | null>(null);
export const hintLoadingAtom = atom<boolean>(false);

export const hintActiveAtom = atom(
  (get) => {
    const settings = get(settingsAtom);
    if (!settings.allowHints) return false;

    const rawActive = get(rawHintActiveAtom);
    if (!rawActive) return false;

    const currentTabId = get(activeTabIdAtom);
    const pinnedTabId = get(rawHintTabIdAtom);
    if (pinnedTabId && pinnedTabId !== currentTabId) {
      return false;
    }

    const currentNodeId = get(currentNodeIdAtom);
    const pinnedNodeId = get(rawHintNodeIdAtom);
    if (pinnedNodeId && pinnedNodeId !== currentNodeId) {
      return false;
    }

    return true;
  },
  (get, set, update: boolean | ((prev: boolean) => boolean)) => {
    const currentActive = get(hintActiveAtom);
    const next = typeof update === 'function' ? update(currentActive) : update;

    if (next) {
      set(rawHintActiveAtom, true);
      set(rawHintTabIdAtom, get(activeTabIdAtom));
      set(rawHintNodeIdAtom, get(currentNodeIdAtom));
      set(updateHintLadderAtom);
    } else {
      set(rawHintActiveAtom, false);
      set(rawHintTabIdAtom, null);
      set(rawHintNodeIdAtom, null);
      set(rawHintLevelAtom, 1);
      set(rawHintDrawerExpandedAtom, false);
      set(rawHintLadderAtom, null);
      set(hintLoadingAtom, false);
    }
  }
);

export const hintLevelAtom = atom(
  (get) => get(rawHintLevelAtom),
  (_get, set, update: number | ((prev: number) => number)) => {
    set(rawHintLevelAtom, (prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      return Math.max(1, Math.min(3, next));
    });
  }
);

export const hintDrawerExpandedAtom = atom(
  (get) => get(rawHintDrawerExpandedAtom),
  (_get, set, update: boolean | ((prev: boolean) => boolean)) => {
    set(rawHintDrawerExpandedAtom, update);
  }
);

export const updateHintLadderAtom = atom(null, (get, set) => {
  const active = get(hintActiveAtom);
  if (!active) {
    set(rawHintLadderAtom, null);
    set(hintLoadingAtom, false);
    return;
  }

  const eq = get(currentEquationAtom);
  if (!eq) {
    set(rawHintLadderAtom, null);
    set(hintLoadingAtom, false);
    return;
  }

  const allowedReduciblePaths = get(filteredReduciblePathsAtom);
  const settings = get(settingsAtom);
  const hasAllowedMap = Object.keys(allowedReduciblePaths).length > 0;

  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    set(rawHintLadderAtom, null);
    set(hintLoadingAtom, true);
    runWorkerHint(eq, undefined, {
      progressiveMode: settings.progressiveMode,
      allowedReduciblePaths: hasAllowedMap ? allowedReduciblePaths : undefined,
    })
      .then((ladder) => {
        if (get(hintActiveAtom)) {
          set(rawHintLadderAtom, ladder);
        }
      })
      .catch(() => {})
      .finally(() => {
        set(hintLoadingAtom, false);
      });
  } else {
    let syncLadder: HintLadder | null = null;
    try {
      syncLadder = getHintLadder(eq, undefined, {
        progressiveMode: settings.progressiveMode,
        allowedReduciblePaths: hasAllowedMap ? allowedReduciblePaths : undefined,
      });
    } catch {
      syncLadder = null;
    }
    set(rawHintLadderAtom, syncLadder);
    set(hintLoadingAtom, false);
  }

});



export const toggleHintActiveAtom = atom(null, (get, set) => {
  const settings = get(settingsAtom);
  if (!settings.allowHints) {
    set(toastAtom, {
      message: 'Hints are disabled in classroom settings',
      key: Date.now(),
    });
    return;
  }

  const isHintable = get(isHintableAtom);
  if (!isHintable) {
    set(toastAtom, {
      message: 'Step-by-step hints are available for single-variable equations',
      key: Date.now(),
    });
    return;
  }

  const currentActive = get(hintActiveAtom);
  if (!currentActive) {
    set(hintLevelAtom, 1);
    set(hintActiveAtom, true);
  } else {
    const currentLevel = get(hintLevelAtom);
    if (currentLevel < 3) {
      set(hintLevelAtom, currentLevel + 1);
    } else {
      set(hintActiveAtom, false);
    }
  }
});

export const nextHintTierAtom = atom(null, (get, set) => {
  const currentLevel = get(hintLevelAtom);
  if (currentLevel < 3) {
    set(hintLevelAtom, currentLevel + 1);
  }
});

export const prevHintTierAtom = atom(null, (get, set) => {
  const currentLevel = get(hintLevelAtom);
  if (currentLevel > 1) {
    set(hintLevelAtom, currentLevel - 1);
  }
});

export const isHintableAtom = atom((get) => {
  const eq = get(currentEquationAtom);
  if (!eq) return false;
  return isHintableEquation(eq);
});

export const hintLadderAtom = atom<HintLadder | null>((get) => {
  const active = get(hintActiveAtom);
  if (!active) return null;
  return get(rawHintLadderAtom);
});

export const hintSpotlightPathAtom = atom<string | null>((get) => {
  const active = get(hintActiveAtom);
  const level = get(hintLevelAtom);
  if (!active || level < 2) return null;

  const ladder = get(hintLadderAtom);
  return ladder?.focusPath ?? null;
});

export const hintSpotlightNodeIdAtom = atom<string | undefined>((get) => {
  const active = get(hintActiveAtom);
  const level = get(hintLevelAtom);
  if (!active || level < 2) return undefined;

  const ladder = get(hintLadderAtom);
  if (ladder?.focusPath === 'equals' || ladder?.focusPath === '=') return undefined;
  return ladder?.targetNodeId;
});

export const hintActionTypeAtom = atom<'reduce' | 'simplify' | 'expand' | 'factor' | 'identity' | 'substitute' | 'equals' | undefined>((get) => {
  const active = get(hintActiveAtom);
  const level = get(hintLevelAtom);
  if (!active || level < 3) return undefined;

  const ladder = get(hintLadderAtom);
  return ladder?.actionType;
});

export const hintDestinationPathAtom = atom<string | undefined>((get) => {
  const active = get(hintActiveAtom);
  const level = get(hintLevelAtom);
  if (!active || level < 3) return undefined;

  const ladder = get(hintLadderAtom);
  return ladder?.destinationPath ?? undefined;
});
