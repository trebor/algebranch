// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sliders, GraduationCap } from 'lucide-react';
import {
  settingsModalOpenAtom,
  settingsAtom,
  TEXT_SIZE_OPTIONS,
  clampChromeScale,
  ANIMATION_SPEED_OPTIONS,
  clampAnimationSpeed,
} from '../store/equation';
import { consentAtom } from '../store/consent';
import { THEME_GLASS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Link from 'next/link';
import { CAPABILITY_GATES } from '../constants/capabilityGates';

export const SettingsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(settingsModalOpenAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const setConsent = useSetAtom(consentAtom);

  const handleClose = () => {
    setIsOpen(false);
  };

  // Focus trap + scroll lock + Escape-to-close + focus restore.
  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  const activeChromeScale = clampChromeScale(settings.chromeScale);

  const handleSelectTextSize = (scale: number) => {
    setSettings((prev) => ({ ...prev, chromeScale: scale }));
    trackEvent({
      action: 'set_text_size',
      category: 'settings',
      label: String(scale),
    });
  };

  const activeAnimationSpeed = clampAnimationSpeed(settings.animationSpeed);

  const handleSelectAnimationSpeed = (speed: number) => {
    setSettings((prev) => ({ ...prev, animationSpeed: speed }));
    trackEvent({
      action: 'set_animation_speed',
      category: 'settings',
      label: String(speed),
    });
  };

  const handleToggleGate = (key: 'allowHints' | 'progressiveMode' | 'exactValues' | 'allowComplex') => {
    const newVal = !settings[key];
    setSettings((prev) => ({
      ...prev,
      [key]: newVal,
    }));
    trackEvent({
      action: `toggle_${key}`,
      category: 'settings',
      label: newVal ? 'on' : 'off',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-md overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-5 select-none shrink-0`}>
              <div className="flex items-center gap-2.5">
                <Sliders className="text-indigo-400 w-5 h-5" />
                <h2 id="settings-modal-title" className="text-lg font-bold text-white tracking-wide">Settings</h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1 min-h-0 flex flex-col gap-5 overflow-y-auto pr-1">
              {/* 1. Classroom Settings Group */}
              <div className="border border-white/5 bg-white/[0.01] rounded-xl p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2 select-none">
                  <GraduationCap size={16} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-300 tracking-wide uppercase">Classroom Settings</span>
                </div>
                <div className="flex flex-col gap-4">
                  {CAPABILITY_GATES.map((gate) => {
                    const isChecked = settings[gate.key];
                    return (
                      <div key={gate.key} className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-white">
                            {gate.label}
                          </span>
                          <span className="text-[10px] text-white/50 leading-snug">
                            {gate.description}
                          </span>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => handleToggleGate(gate.key)}
                          className={`${THEME_GLASS.TOGGLE_TRACK} ${
                            isChecked
                              ? THEME_GLASS.TOGGLE_TRACK_ON
                              : THEME_GLASS.TOGGLE_TRACK_OFF
                          }`}
                          role="switch"
                          aria-checked={isChecked}
                          aria-label={`Toggle ${gate.label.toLowerCase()} option`}
                        >
                          <span
                            className={`${THEME_GLASS.TOGGLE_KNOB} ${
                              isChecked ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Display & Motion Group */}
              <div className="flex flex-col gap-4">
                <div className={THEME_GLASS.SETTING_ROW_STACKED}>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-white">
                      Interface text size
                    </span>
                    <span className={`text-xs leading-snug ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                      Enlarge menus, tooltips, and labels. The equation stays as it is — use your browser&rsquo;s zoom to enlarge everything.
                    </span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Interface text size"
                    className={`${THEME_GLASS.SEGMENT_GROUP} w-full`}
                  >
                    {TEXT_SIZE_OPTIONS.map((opt) => {
                      const isActive = activeChromeScale === opt.scale;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          aria-label={opt.label}
                          onClick={() => handleSelectTextSize(opt.scale)}
                          className={`${THEME_GLASS.SEGMENT_BTN} flex-1 ${
                            isActive
                              ? THEME_GLASS.SEGMENT_BTN_ACTIVE
                              : THEME_GLASS.SEGMENT_BTN_IDLE
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={THEME_GLASS.SETTING_ROW_STACKED}>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-white">
                      Animation speed
                    </span>
                    <span className={`text-xs leading-snug ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                      Adjust transition speeds for transpositions and operations. Reduced motion overrides this setting.
                    </span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Animation speed"
                    className={`${THEME_GLASS.SEGMENT_GROUP} w-full`}
                  >
                    {ANIMATION_SPEED_OPTIONS.map((opt) => {
                      const isActive = activeAnimationSpeed === opt.speed;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          aria-label={opt.label}
                          onClick={() => handleSelectAnimationSpeed(opt.speed)}
                          className={`${THEME_GLASS.SEGMENT_BTN} flex-1 ${
                            isActive
                              ? THEME_GLASS.SEGMENT_BTN_ACTIVE
                              : THEME_GLASS.SEGMENT_BTN_IDLE
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Privacy & Cookies Group */}
              <div className={THEME_GLASS.SETTING_ROW}>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-white">
                    Privacy & Cookies
                  </span>
                  <span className={`text-xs leading-snug ${THEME_GLASS.TEXT_MUTED_LIGHT}`}>
                    Review what anonymous analytics data we collect or update your cookie tracking preferences.
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 self-center">
                  <Link
                    href="/privacy"
                    onClick={() => setIsOpen(false)}
                    className={`${THEME_GLASS.LINK} text-xs font-bold text-center no-underline`}
                  >
                    Privacy Policy
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setConsent('unset');
                      setIsOpen(false);
                    }}
                    className={`${THEME_GLASS.LINK} text-xs font-bold bg-transparent border-none cursor-pointer p-0 text-center`}
                  >
                    Cookie Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex justify-end items-center mt-6 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 select-none shrink-0`}>
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_SECONDARY}`}
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

