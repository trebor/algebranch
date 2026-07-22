// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { atom } from 'jotai';
import { PRACTICE_SETS } from '../constants/ladders';
import { PRESET_LIST } from '../constants/presets';
import {
  resetToEquationStringAtom,
  currentEquationAtom,
  terminalStatusAtom,
} from './equation';
import { getIsolatedDefinition, getVariables, generateEquationVariation } from 'math-engine';
import { trackEvent } from '../utils/analytics';
import { safeStorage } from '../utils/safeStorage';

export const PRACTICE_SET_STORAGE_KEY = 'algebranch_practice_sets';

export interface PracticeSetProgress {
  activeSetId: string | null;
  position: number;
  completedSetIds: string[];
  setPositions: Record<string, number>;
}

export const DEFAULT_PRACTICE_SET_PROGRESS: PracticeSetProgress = {
  activeSetId: null,
  position: 0,
  completedSetIds: [],
  setPositions: {},
};

export const getPracticeSetsFromStorage = (): PracticeSetProgress => {
  try {
    const raw = safeStorage.getItem(PRACTICE_SET_STORAGE_KEY);
    if (!raw) return DEFAULT_PRACTICE_SET_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<PracticeSetProgress>;
    return {
      activeSetId: typeof parsed.activeSetId === 'string' ? parsed.activeSetId : null,
      position: typeof parsed.position === 'number' ? parsed.position : 0,
      completedSetIds: Array.isArray(parsed.completedSetIds) ? parsed.completedSetIds : [],
      setPositions: typeof parsed.setPositions === 'object' && parsed.setPositions !== null ? parsed.setPositions : {},
    };
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
    const def = getIsolatedDefinition(currentEq);
    if (!def) return false;
    const rhsVars = getVariables(def.expression);
    return rhsVars.length === 0;
  } catch {
    return false;
  }
});

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

    const nextProgress: PracticeSetProgress = {
      ...currentProgress,
      activeSetId: payload.setId,
      position: targetPos,
      setPositions: {
        ...currentProgress.setPositions,
        [payload.setId]: Math.max(currentProgress.setPositions[payload.setId] ?? 0, targetPos),
      },
    };

    set(practiceSetProgressAtom, nextProgress);

    const presetId = practiceSet.presetIds[targetPos];
    const preset = PRESET_LIST.find((p) => p.id === presetId);
    if (preset) {
      const seed = Date.now() + targetPos;
      const targetVariable = targetPos === 0 ? 'x' : undefined;
      const variation = generateEquationVariation(preset.equation, { seed, targetVariable });
      set(resetToEquationStringAtom, variation, preset.label);
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
    const nextProgress: PracticeSetProgress = {
      ...currentProgress,
      position: nextPos,
      setPositions: {
        ...currentProgress.setPositions,
        [active.set.id]: Math.max(currentProgress.setPositions[active.set.id] ?? 0, nextPos),
      },
    };
    set(practiceSetProgressAtom, nextProgress);

    const nextPresetId = active.set.presetIds[nextPos];
    const preset = PRESET_LIST.find((p) => p.id === nextPresetId);
    if (preset) {
      const seed = Date.now() + nextPos;
      const targetVariable = nextPos === 0 ? 'x' : undefined;
      const variation = generateEquationVariation(preset.equation, { seed, targetVariable });
      set(resetToEquationStringAtom, variation, preset.label);
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

export const exitPracticeSetAtom = atom(null, (get, set) => {
  const currentProgress = get(practiceSetProgressAtom);
  set(practiceSetProgressAtom, {
    ...currentProgress,
    activeSetId: null,
  });
});
