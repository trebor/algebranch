// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom } from 'jotai';
import { TriangleAlert } from 'lucide-react';
import { settingsAtom, toastAtom, getPresetMismatchedSettings, getPresetRequiredSettingsList } from '../store/equation';
import { Preset } from '../constants/presets';
import { THEME_GLASS } from '../constants/theme';

interface SolvePageSettingsCheckProps {
  readonly preset: Preset;
}

const emptySubscribe = () => () => {};

export const SolvePageSettingsCheck: React.FC<SolvePageSettingsCheckProps> = ({ preset }) => {
  const [settings, setSettings] = useAtom(settingsAtom);
  const [, setToast] = useAtom(toastAtom);

  const isHydrated = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const handleFix = React.useCallback(
    (key: keyof typeof settings, label: string, requiredValue: boolean) => {
      setSettings((prev) => ({
        ...prev,
        [key]: requiredValue,
      }));
      setToast({
        message: `Enabled ${label} setting.`,
        key: Date.now(),
      });
    },
    [setSettings, setToast]
  );

  if (!preset.requiredSettings) return null;

  const requiredList = getPresetRequiredSettingsList(preset);
  if (requiredList.length === 0) return null;

  const mismatches = getPresetMismatchedSettings(preset, settings);
  if (!isHydrated || mismatches.length === 0) return null;

  const mismatchLabels = mismatches.map((m) => m.label).join(', ');

  return (
    <div className={THEME_GLASS.SETTING_WARNING_CARD}>
      <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
        <div className="flex items-start gap-2.5">
          <TriangleAlert size={16} className={`${THEME_GLASS.TOOLTIP_ASSUMPTION_ICON} mt-0.5`} />
          <div className="flex flex-col gap-1 text-left">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Setting Requirement Alert
            </span>
            <p className={`text-xs ${THEME_GLASS.TEXT_MUTED} leading-relaxed`}>
              {mismatchLabels} is currently disabled. Opening in the workspace will automatically enable it.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-center sm:self-start">
          {mismatches.map((m) => (
            <button
              key={m.key}
              onClick={() => handleFix(m.key, m.label, m.requiredValue)}
              className={THEME_GLASS.SETTING_WARNING_BADGE}
            >
              Enable {m.label} Now
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
