// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSetAtom, useAtom, useAtomValue } from 'jotai';
import {
  applyGlobalOpAtom,
  swapSidesAtom,
  radialMenuOpenAtom,
  onboardingChapterIdAtom,
  onboardingGlobalOpAtom,
  settingsAtom,
  clampChromeScale,
} from '../store/equation';
import { trackEvent } from '../utils/analytics';
import { ArrowLeftRight, Plus, Minus, Divide } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { THEME_GLASS } from '../constants/theme';
import { MULTIPLY_SYMBOL } from '../constants/mathSymbols';
import {
  RADIAL_ANGLE_START_DEG,
  RADIAL_PETAL_COUNT,
  radialRadiusPx,
  radialIconPx,
  radialSpinnerIconPx,
} from '../utils/radialLayout';

/**
 * Global operation types available in the radial menu.
 * These are the operations that affect both sides of the equation.
 */
type RadialAction =
  | { type: 'square' }
  | { type: 'sqrt' }
  | { type: 'power'; power: number }
  | { type: 'root'; power: number }
  | { type: 'add' }
  | { type: 'sub' }
  | { type: 'mul' }
  | { type: 'div' }
  | { type: 'swap' };

interface RadialPetal {
  /** Glyph factory — `iconPx` scales lucide icons with the text-size knob (#278). */
  icon: (iconPx: number) => React.ReactNode;
  label: string;
  tooltip: string;
  action: RadialAction;
  color: string;
}

const PETALS: RadialPetal[] = [
  { icon: (px) => <ArrowLeftRight size={px} />, label: '↔', tooltip: 'Swap left and right sides', action: { type: 'swap' }, color: 'text-amber-400' },
  { icon: () => <span className="text-sm font-bold">xⁿ</span>, label: 'xⁿ', tooltip: 'Raise both sides to nth power', action: { type: 'power', power: 2 }, color: 'text-teal-400' },
  { icon: (px) => <Plus size={px} />, label: '+', tooltip: 'Add term to both sides', action: { type: 'add' }, color: 'text-indigo-400' },
  { icon: (px) => <Minus size={px} />, label: '−', tooltip: 'Subtract term from both sides', action: { type: 'sub' }, color: 'text-violet-400' },
  { icon: () => <span className="text-xl font-bold leading-none">{MULTIPLY_SYMBOL}</span>, label: MULTIPLY_SYMBOL, tooltip: 'Multiply both sides by term', action: { type: 'mul' }, color: 'text-rose-400' },
  { icon: (px) => <Divide size={px} />, label: '÷', tooltip: 'Divide both sides by term', action: { type: 'div' }, color: 'text-pink-400' },
  { icon: () => <span className="text-sm font-bold">ⁿ√</span>, label: 'ⁿ√', tooltip: 'Take nth root of both sides', action: { type: 'root', power: 2 }, color: 'text-emerald-400' },
];

interface RadialMenuProps {
  /** Ref to the equals sign element for positioning */
  anchorRef: React.RefObject<HTMLElement | null>;
}

/**
 * RadialMenu — A circular action menu that blooms from the equals sign.
 * Each petal represents a global operation (applies to both sides of the equation).
 */
export const RadialMenu: React.FC<RadialMenuProps> = ({ anchorRef }) => {
  const [isOpen, setIsOpen] = useAtom(radialMenuOpenAtom);
  const applyGlobalOp = useSetAtom(applyGlobalOpAtom);
  const swapSides = useSetAtom(swapSidesAtom);
  const isTourActive = !!useAtomValue(onboardingChapterIdAtom);
  const tourGlobalOp = useAtomValue(onboardingGlobalOpAtom);

  // The petal circles are rem-sized, so the text-size knob (#239) grows them via
  // `--chrome-scale`. Scale the px ring radius and lucide glyphs by the same
  // factor so the menu enlarges as one piece instead of overlapping into a
  // "flower" with tiny icons (#278).
  const chromeScale = clampChromeScale(useAtomValue(settingsAtom).chromeScale);
  const radius = radialRadiusPx(chromeScale);
  const iconPx = radialIconPx(chromeScale);
  const spinnerIconPx = radialSpinnerIconPx(chromeScale);
  const [termInputAction, setTermInputAction] = React.useState<RadialAction | null>(null);
  const [termValue, setTermValue] = React.useState('');
  const [spinnerValue, setSpinnerValue] = React.useState(2);
  const [errorStr, setErrorStr] = React.useState<string | null>(null);
  const termInputRef = React.useRef<HTMLInputElement>(null);

  // Position state for floating menu
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);

  // Calculate position relative to anchor
  React.useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  }, [isOpen, anchorRef]);


  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setTermInputAction(null);
        setTermValue('');
        setErrorStr(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, setIsOpen]);

  // Focus term input when it appears (not during the tour — the value is
  // locked, and focusing would pop the keyboard on mobile for nothing)
  React.useEffect(() => {
    if (termInputAction && termInputRef.current && !isTourActive) {
      termInputRef.current.focus();
    }
  }, [termInputAction, isTourActive]);

  // During the tour, only the petal performing the active step's global op is
  // live; the spinner/term petals share one petal per family (sqrt -> nth root).
  const petalMatchesTourOp = (action: RadialAction): boolean => {
    if (!tourGlobalOp) return false;
    if (action.type === 'root') return tourGlobalOp.type === 'root' || tourGlobalOp.type === 'sqrt';
    if (action.type === 'power') return tourGlobalOp.type === 'power' || tourGlobalOp.type === 'square';
    return action.type === tourGlobalOp.type;
  };

  // Whether the staged input matches what the tour step expects; gates Apply
  // so the learner can't fire an off-script operation mid-tutorial.
  const tourExpectedPower = tourGlobalOp?.power ?? 2;
  const tourInputSatisfied = !isTourActive
    ? true
    : !tourGlobalOp
      ? false
      : termInputAction?.type === 'power' || termInputAction?.type === 'root'
        ? spinnerValue === tourExpectedPower
        : termValue.trim() === (tourGlobalOp.term ?? '');

  const handlePetalClick = (petal: RadialPetal) => {
    const { action } = petal;

    if (isTourActive && !petalMatchesTourOp(action)) return;

    if (action.type === 'swap') {
      swapSides();
      trackEvent({ action: 'radial_swap_sides', category: 'operations' });
      setIsOpen(false);
      return;
    }

    // Operations that need input (term input or spinner)
    if (
      action.type === 'add' ||
      action.type === 'sub' ||
      action.type === 'mul' ||
      action.type === 'div' ||
      action.type === 'power' ||
      action.type === 'root'
    ) {
      setTermInputAction(action);
      // Tour steps arrive with their parameter preset (and locked in the UI)
      if (action.type === 'power' || action.type === 'root') {
        setSpinnerValue(isTourActive && tourGlobalOp ? tourGlobalOp.power ?? 2 : 2);
      } else if (isTourActive && tourGlobalOp?.term) {
        setTermValue(tourGlobalOp.term);
      }
      return;
    }
  };

  const handleTermSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termInputAction) return;

    try {
      setErrorStr(null);
      if (termInputAction.type === 'power') {
        applyGlobalOp({ type: 'power', power: spinnerValue });
        trackEvent({
          action: 'radial_power',
          category: 'operations',
          label: String(spinnerValue),
        });
      } else if (termInputAction.type === 'root') {
        applyGlobalOp({ type: 'root', power: spinnerValue });
        trackEvent({
          action: 'radial_root',
          category: 'operations',
          label: String(spinnerValue),
        });
      } else {
        if (!termValue.trim()) return;
        applyGlobalOp({ type: termInputAction.type as 'add' | 'sub' | 'mul' | 'div', term: termValue.trim() });
        trackEvent({
          action: `radial_${termInputAction.type}`,
          category: 'operations',
          label: termValue.trim(),
        });
      }
      setTermValue('');
      setSpinnerValue(2);
      setTermInputAction(null);
      setIsOpen(false);
    } catch (err) {
      setErrorStr(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTermInputAction(null);
    setTermValue('');
    setErrorStr(null);
  };

  if (!position && isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && position && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Radial Container — positioned at the = sign */}
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: position.x,
              top: position.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Center = sign glow */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.3 }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${THEME_GLASS.RADIAL_CENTER}`}
              onClick={handleClose}
            >
              <span className="text-xl font-mono font-bold text-indigo-300">=</span>
            </motion.div>

            {/* Petals */}
            {!termInputAction && PETALS.map((petal, i) => {
              const angle = RADIAL_ANGLE_START_DEG + (i * 360) / RADIAL_PETAL_COUNT;
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;

              const isTourPetal = isTourActive && petalMatchesTourOp(petal.action);
              const isPetalLocked = isTourActive && !isTourPetal;

              return (
                <Tooltip
                  key={petal.label}
                  content={petal.tooltip}
                  position="top"
                >
                  <motion.button
                    initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    animate={{ scale: 1, opacity: isPetalLocked ? 0.35 : 1, x, y }}
                    exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    transition={{
                      type: 'spring',
                      duration: 0.4,
                      bounce: 0.35,
                      delay: i * 0.03,
                    }}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${THEME_GLASS.RADIAL_PETAL} ${petal.color} ${
                      isPetalLocked
                        ? THEME_GLASS.RADIAL_PETAL_LOCKED
                        : THEME_GLASS.RADIAL_PETAL_HOVER
                    }`}
                    onClick={() => handlePetalClick(petal)}
                    aria-label={petal.tooltip || petal.label}
                  >
                    {petal.icon(iconPx)}
                    {isTourPetal && (
                      <span aria-hidden="true" className={`-inset-[0.35em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
                    )}
                  </motion.button>
                </Tooltip>
              );
            })}

            {/* Term Input (appears when +, −, ⋅, ÷ is tapped) */}
            <AnimatePresence>
              {termInputAction && (
                <motion.form
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: radius + 12 }}
                  exit={{ scale: 0.8, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
                  onSubmit={handleTermSubmit}
                  className="absolute left-1/2 -translate-x-1/2 top-1/2 pointer-events-auto flex flex-col items-center gap-2"
                >
                  <div className={THEME_GLASS.RADIAL_INPUT_PANEL}>
                    <span className={`text-sm font-bold ${THEME_GLASS.MATH_OP_ACTIVE} w-10 text-center flex items-center justify-center`}>
                      {termInputAction.type === 'add' ? (
                        '+'
                      ) : termInputAction.type === 'sub' ? (
                        '−'
                      ) : termInputAction.type === 'mul' ? (
                        MULTIPLY_SYMBOL
                      ) : termInputAction.type === 'div' ? (
                        '÷'
                      ) : termInputAction.type === 'power' ? (
                        <span>( )<sup>{spinnerValue}</sup></span>
                      ) : (
                        <span><sup>{spinnerValue}</sup>√</span>
                      )}
                    </span>
                    {termInputAction.type === 'power' || termInputAction.type === 'root' ? (
                      <div className={THEME_GLASS.SPINNER_BOX}>
                        {isTourActive && tourGlobalOp && !tourInputSatisfied && (
                          <span aria-hidden="true" className={`-inset-[0.3em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
                        )}
                        <button
                          type="button"
                          disabled={spinnerValue <= 2 || isTourActive}
                          onClick={() => setSpinnerValue((v) => Math.max(2, v - 1))}
                          className={THEME_GLASS.SPINNER_BTN}
                          aria-label="Decrease value"
                        >
                          <Minus size={spinnerIconPx} className="text-white" />
                        </button>
                        <span className="w-6 text-center text-sm font-mono font-bold text-white">
                          {spinnerValue}
                        </span>
                        <button
                          type="button"
                          disabled={isTourActive}
                          onClick={() => setSpinnerValue((v) => v + 1)}
                          className={THEME_GLASS.SPINNER_BTN}
                          aria-label="Increase value"
                        >
                          <Plus size={spinnerIconPx} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <span className="relative">
                        <input
                          ref={termInputRef}
                          type="text"
                          value={termValue}
                          readOnly={isTourActive}
                          onChange={(e) => setTermValue(e.target.value)}
                          placeholder="e.g. 5x"
                          className={`w-28 px-2 py-1 text-sm text-white ${THEME_GLASS.FIELD_INPUT} ${
                            isTourActive ? 'cursor-default text-white/80' : 'focus:border-indigo-500/80'
                          }`}
                        />
                        {isTourActive && tourGlobalOp && !tourInputSatisfied && (
                          <span aria-hidden="true" className={`-inset-[0.3em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
                        )}
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isTourActive && !tourInputSatisfied}
                      className={THEME_GLASS.BUTTON_PRIMARY_SM}
                    >
                      Apply
                      {isTourActive && tourInputSatisfied && (
                        <span aria-hidden="true" className={`-inset-[0.3em] ${THEME_GLASS.ONBOARDING_CIRCLE}`} />
                      )}
                    </button>
                  </div>
                  {errorStr && (
                    <div className={THEME_GLASS.ALERT_DANGER_SM}>
                      {errorStr}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTermInputAction(null);
                      setTermValue('');
                      setErrorStr(null);
                    }}
                    className={THEME_GLASS.TEXT_BUTTON_MUTED}
                  >
                    Back to menu
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
