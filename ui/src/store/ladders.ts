// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { atom } from 'jotai';
import { PRACTICE_SETS } from '../constants/ladders';
import { PRESET_LIST } from '../constants/presets';
import {
  resetToEquationStringAtom,
  currentEquationAtom,
  terminalStatusAtom,
  tabsAtom,
  activeTabIdAtom,
} from './equation';
import { isEquationSolved, generateEquationVariation } from 'math-engine';
import { equationToString } from 'math-engine-client';
import { trackEvent } from '../utils/analytics';
import { safeStorage } from '../utils/safeStorage';

export const PRACTICE_SET_STORAGE_KEY = 'algebranch_practice_sets';

export interface PracticeSetProgress {
  activeSetId: string | null;
  position: number;
  completedSetIds: string[];
  setPositions: Record<string, number>;
  generatedEquations?: Record<string, Record<number, string>>;
}

export const DEFAULT_PRACTICE_SET_PROGRESS: PracticeSetProgress = {
  activeSetId: null,
  position: 0,
  completedSetIds: [],
  setPositions: {},
  generatedEquations: {},
};

export const getPracticeSetsFromStorage = (): PracticeSetProgress => {
  try {
    const raw = safeStorage.getItem(PRACTICE_SET_STORAGE_KEY);
    if (!raw) return DEFAULT_PRACTICE_SET_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<PracticeSetProgress>;
    const progress: PracticeSetProgress = {
      activeSetId: typeof parsed.activeSetId === 'string' ? parsed.activeSetId : null,
      position: typeof parsed.position === 'number' ? parsed.position : 0,
      completedSetIds: Array.isArray(parsed.completedSetIds) ? parsed.completedSetIds : [],
      setPositions: typeof parsed.setPositions === 'object' && parsed.setPositions !== null ? parsed.setPositions : {},
    };
    if (parsed.generatedEquations && typeof parsed.generatedEquations === 'object') {
      progress.generatedEquations = parsed.generatedEquations;
    }
    return progress;
  } catch {
    return DEFAULT_PRACTICE_SET_PROGRESS;
  }
};

export const savePracticeSetsToStorage = (progress: PracticeSetProgress): void => {
  try {
    safeStorage.setItem(PRACTICE_SET_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore storage write failures */
  }
};

export const rawPracticeSetProgressAtom = atom<PracticeSetProgress>(DEFAULT_PRACTICE_SET_PROGRESS);

export const practiceSetProgressAtom = atom(
  (get) => get(rawPracticeSetProgressAtom),
  (_get, set, update: PracticeSetProgress | ((prev: PracticeSetProgress) => PracticeSetProgress)) => {
    set(rawPracticeSetProgressAtom, (prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      savePracticeSetsToStorage(next);
      return next;
    });
  }
);

export const hydratePracticeSetsAtom = atom(null, (_get, set) => {
  const loaded = getPracticeSetsFromStorage();
  set(rawPracticeSetProgressAtom, loaded);
});

export const activePracticeSetAtom = atom((get) => {
  const progress = get(practiceSetProgressAtom);
  if (!progress.activeSetId) return null;
  const set = PRACTICE_SETS.find((s) => s.id === progress.activeSetId);
  if (!set) return null;
  const isCompleted = progress.completedSetIds.includes(set.id);
  return {
    set,
    position: progress.position,
    isCompleted,
  };
});

export const readyForNextProblemAtom = atom((get) => {
  const active = get(activePracticeSetAtom);
  if (!active) return false;

  const terminalStatus = get(terminalStatusAtom);
  if (terminalStatus !== null) return true;

  const currentEq = get(currentEquationAtom);
  if (!currentEq) return false;

  try {
    return isEquationSolved(currentEq);
  } catch {
    return false;
  }
});

const getDeterministicSeed = (setId: string, position: number): number => {
  let hash = 0;
  const str = `algebranch_seed_${setId}_${position}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const startPracticeSetAtom = atom(
  null,
  (get, set, payload: { setId: string; position?: number }) => {
    const practiceSet = PRACTICE_SETS.find((s) => s.id === payload.setId);
    if (!practiceSet || practiceSet.presetIds.length === 0) return;

    const currentProgress = get(practiceSetProgressAtom);
    const targetPos = Math.max(
      0,
      Math.min(
        payload.position ?? currentProgress.setPositions[payload.setId] ?? 0,
        practiceSet.presetIds.length - 1
      )
    );

    let eqStr = currentProgress.generatedEquations?.[payload.setId]?.[targetPos];
    if (!eqStr) {
      const presetId = practiceSet.presetIds[targetPos];
      const preset = PRESET_LIST.find((p) => p.id === presetId);
      if (preset) {
        const seed = getDeterministicSeed(payload.setId, targetPos);
        const targetVariable = targetPos === 0 ? 'x' : undefined;
        const varyStructure = practiceSet.id !== 'linear_basics';
        eqStr = generateEquationVariation(preset.equation, { seed, targetVariable, varyStructure });
      }
    }

    if (!eqStr) return;

    const nextProgress: PracticeSetProgress = {
      ...currentProgress,
      activeSetId: payload.setId,
      position: targetPos,
      setPositions: {
        ...currentProgress.setPositions,
        [payload.setId]: Math.max(currentProgress.setPositions[payload.setId] ?? 0, targetPos),
      },
      generatedEquations: {
        ...currentProgress.generatedEquations,
        [payload.setId]: {
          ...(currentProgress.generatedEquations?.[payload.setId] ?? {}),
          [targetPos]: eqStr,
        },
      },
    };

    set(practiceSetProgressAtom, nextProgress);

    const presetId = practiceSet.presetIds[targetPos];
    const preset = PRESET_LIST.find((p) => p.id === presetId);
    const tabName = preset?.label || eqStr;

    // Check if an existing open tab matches this equation string to prevent duplicate tab creation
    const existingTabs = get(tabsAtom);
    const matchingTab = existingTabs.find((tab) => {
      const rootNode = tab.historyTree['0'];
      if (!rootNode) return false;
      const rootEqStr = equationToString(rootNode.equation);
      return rootEqStr === eqStr || tab.name === tabName;
    });

    if (matchingTab) {
      set(activeTabIdAtom, matchingTab.id);
    } else {
      set(resetToEquationStringAtom, eqStr, tabName, { dedupe: true });
    }

    trackEvent({
      action: 'ladder_started',
      category: 'practice_sets',
      label: payload.setId,
      value: targetPos,
    });
  }
);

export const advancePracticeSetAtom = atom(null, (get, set) => {
  const active = get(activePracticeSetAtom);
  if (!active) return;

  const currentProgress = get(practiceSetProgressAtom);
  const nextPos = active.position + 1;

  if (nextPos < active.set.presetIds.length) {
    let eqStr = currentProgress.generatedEquations?.[active.set.id]?.[nextPos];
    if (!eqStr) {
      const nextPresetId = active.set.presetIds[nextPos];
      const preset = PRESET_LIST.find((p) => p.id === nextPresetId);
      if (preset) {
        const seed = getDeterministicSeed(active.set.id, nextPos);
        const targetVariable = nextPos === 0 ? 'x' : undefined;
        const varyStructure = active.set.id !== 'linear_basics';
        eqStr = generateEquationVariation(preset.equation, { seed, targetVariable, varyStructure });
      }
    }

    const nextProgress: PracticeSetProgress = {
      ...currentProgress,
      position: nextPos,
      setPositions: {
        ...currentProgress.setPositions,
        [active.set.id]: Math.max(currentProgress.setPositions[active.set.id] ?? 0, nextPos),
      },
      generatedEquations: {
        ...currentProgress.generatedEquations,
        [active.set.id]: {
          ...(currentProgress.generatedEquations?.[active.set.id] ?? {}),
          [nextPos]: eqStr || '',
        },
      },
    };
    set(practiceSetProgressAtom, nextProgress);

    if (eqStr) {
      const nextPresetId = active.set.presetIds[nextPos];
      const preset = PRESET_LIST.find((p) => p.id === nextPresetId);
      const tabName = preset?.label || eqStr;

      const existingTabs = get(tabsAtom);
      const matchingTab = existingTabs.find((tab) => {
        const rootNode = tab.historyTree['0'];
        if (!rootNode) return false;
        const rootEqStr = equationToString(rootNode.equation);
        return rootEqStr === eqStr || tab.name === tabName;
      });

      if (matchingTab) {
        set(activeTabIdAtom, matchingTab.id);
      } else {
        set(resetToEquationStringAtom, eqStr, tabName, { dedupe: true });
      }
    }

    trackEvent({
      action: 'ladder_advanced',
      category: 'practice_sets',
      label: active.set.id,
      value: nextPos,
    });
  } else {
    const completedSetIds = Array.from(new Set([...currentProgress.completedSetIds, active.set.id]));
    const nextProgress: PracticeSetProgress = {
      ...currentProgress,
      completedSetIds,
    };
    set(practiceSetProgressAtom, nextProgress);

    trackEvent({
      action: 'ladder_completed',
      category: 'practice_sets',
      label: active.set.id,
    });
  }
});

export const recordProblemSolvedAtom = atom(null, (get, set) => {
  const active = get(activePracticeSetAtom);
  if (!active) return;

  const currentProgress = get(practiceSetProgressAtom);
  const nextPos = Math.min(active.position + 1, active.set.presetIds.length);
  const isLastProblem = active.position >= active.set.presetIds.length - 1;

  const completedSetIds = isLastProblem
    ? Array.from(new Set([...currentProgress.completedSetIds, active.set.id]))
    : currentProgress.completedSetIds;

  const nextProgress: PracticeSetProgress = {
    ...currentProgress,
    completedSetIds,
    setPositions: {
      ...currentProgress.setPositions,
      [active.set.id]: Math.max(currentProgress.setPositions[active.set.id] ?? 0, nextPos),
    },
  };

  set(practiceSetProgressAtom, nextProgress);
});

export const exitPracticeSetAtom = atom(null, (get, set) => {
  const currentProgress = get(practiceSetProgressAtom);
  set(practiceSetProgressAtom, {
    ...currentProgress,
    activeSetId: null,
  });
});
